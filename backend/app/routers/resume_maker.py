import json
import logging
import os
import shutil
import subprocess
import tempfile
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from beanie import PydanticObjectId
import urllib.parse
import filetype

from app.middleware.auth_middleware import get_current_user
from app.middleware.admin_middleware import get_admin_user
from app.models.resume_template import ResumeTemplate
from app.models.resume import Resume
from app.models.user import User
from app.services import storage_service, ai_service
from app.rate_limiter import limiter
from pydantic import BaseModel

class SmartFillRequest(BaseModel):
    resume_id: Optional[str] = None

router = APIRouter(prefix="/api/resume-maker", tags=["resume-maker"])

logger = logging.getLogger(__name__)

# Order matters: the backslash must be escaped first, otherwise the backslashes
# we introduce for the other characters would themselves be re-escaped.
_LATEX_ESCAPES = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("$", r"\$"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
]


def _latex_escape(value: str) -> str:
    """Neutralize LaTeX control characters in untrusted user input.

    Without this, a field value like ``\\input{/etc/passwd}`` would be compiled
    verbatim, letting a user read arbitrary server files into the generated PDF
    (or hang the compiler with a recursive macro)."""
    for target, replacement in _LATEX_ESCAPES:
        value = value.replace(target, replacement)
    return value


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.get("/templates")
@limiter.limit("20/minute")
async def get_templates(request: Request, user: User = Depends(get_current_user)):
    """Fetch all available resume templates."""
    templates = await ResumeTemplate.find_all().to_list()
    return {"templates": templates}


@router.post("/templates")
@limiter.limit("5/minute")
async def create_template(
    request: Request,
    name: str = Form(...),
    description: str = Form(""),
    latex_code: str = Form(...),
    required_fields: str = Form("[]"),  # JSON string of list of strings
    image: UploadFile = File(...),
    user: User = Depends(get_admin_user)
):
    """(Admin only) Create a new resume template."""
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WEBP images are allowed")

    contents = await image.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image size exceeds 5 MB limit")

    kind = filetype.guess(contents)
    if kind is None or kind.mime not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image content")

    try:
        parsed_fields = json.loads(required_fields)
        if not isinstance(parsed_fields, list):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=400, detail="required_fields must be a JSON array of strings")

    safe_filename = urllib.parse.quote(image.filename or "template.png")
    
    # Upload to R2 / Cloud
    key = await run_in_threadpool(
        storage_service.upload_file,
        file_bytes=contents,
        original_filename=safe_filename,
        folder="resume_templates",
        content_type=kind.mime,
    )
    url = storage_service.get_file_url(key)

    template = ResumeTemplate(
        name=name,
        description=description,
        image_url=url,
        latex_code=latex_code,
        required_fields=parsed_fields
    )
    await template.insert()

    return {"message": "Template created successfully", "template": template}


@router.post("/templates/{template_id}/compile")
@limiter.limit("5/minute")
async def compile_template(
    request: Request,
    template_id: str,
    data: Dict[str, Any],
    user: User = Depends(get_current_user)
):
    """Compile a resume template with user data."""
    try:
        template = await ResumeTemplate.get(PydanticObjectId(template_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Template ID")
        
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Replace placeholders. e.g. {{Name}} -> John Doe
    latex_content = template.latex_code
    for field in template.required_fields:
        value = _latex_escape(str(data.get(field, "")))
        latex_content = latex_content.replace(f"{{{{{field}}}}}", value)

    from fastapi.responses import Response
    from app.services import latex_service
    
    try:
        pdf_bytes = await latex_service.compile_latex_to_pdf(latex_content)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="LaTeX compilation failed.")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=resume.pdf"},
    )

@router.post("/templates/{template_id}/smart-fill")
@limiter.limit("5/minute")
async def smart_fill_template(
    request: Request,
    template_id: str,
    payload: SmartFillRequest,
    user: User = Depends(get_current_user)
):
    """Smart fill a resume template form using an existing parsed resume."""
    try:
        template = await ResumeTemplate.get(PydanticObjectId(template_id))
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
            
        resume_text = ""
        if payload.resume_id:
            resume = await Resume.get(PydanticObjectId(payload.resume_id))
            if resume and resume.user_id == user.id:
                resume_text = resume.extracted_text

        user_profile = {
            "full_name": user.full_name,
            "bio": user.bio,
            "phone": user.phone,
            "skills": user.skills,
            "education": [dict(e) for e in user.education] if user.education else [],
            "experience": [dict(e) for e in user.experience] if user.experience else [],
            "linkedin_url": user.linkedin_url,
            "github_url": user.github_url,
            "portfolio_url": user.portfolio_url
        }
            
        filled_data = await ai_service.smart_fill_resume_fields(
            resume_text=resume_text, 
            required_fields=template.required_fields,
            user_profile=user_profile
        )
        
        return {"filled_data": filled_data}
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Smart fill failed for template %s", template_id)
        raise HTTPException(status_code=502, detail="Could not auto-fill the template right now. Please try again.")
