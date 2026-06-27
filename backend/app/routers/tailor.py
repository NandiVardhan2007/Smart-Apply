from fastapi import APIRouter, Depends, Form, HTTPException, File, UploadFile, Body
from fastapi.responses import Response
from beanie import PydanticObjectId
from typing import List, Optional
from pydantic import BaseModel
import httpx
import logging

from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.services import latex_service, ai_service
from app.services.email_service import send_tailored_resume_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tailor", tags=["tailor"])

class TailorRequest(BaseModel):
    resume_id: str
    recommendations: List[str] = []
    custom_instructions: str = ""

@router.post("/extract-latex")
async def extract_latex(resume_id: str = Body(..., embed=True), user: User = Depends(get_current_user)):
    """Extract LaTeX from a resume PDF using the NVIDIA image model."""
    try:
        resume = await Resume.get(PydanticObjectId(resume_id))
        if not resume or resume.user_id != user.id:
            raise HTTPException(status_code=404, detail="Resume not found")
            
        # Download the PDF from file_url to memory
        async with httpx.AsyncClient() as client:
            resp = await client.get(resume.file_url)
            resp.raise_for_status()
            pdf_content = resp.content
            
        # Extract LaTeX
        latex_code = await latex_service.extract_latex_from_pdf(pdf_content)
        
        # Save to DB
        resume.latex_code = latex_code
        await resume.save()
        
        return {"latex_code": latex_code}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/extract-html")
async def extract_html(resume_id: str = Body(..., embed=True), user: User = Depends(get_current_user)):
    """Extract HTML from a resume PDF using the NVIDIA image model."""
    try:
        resume = await Resume.get(PydanticObjectId(resume_id))
        if not resume or resume.user_id != user.id:
            raise HTTPException(status_code=404, detail="Resume not found")
            
        # Download the PDF from file_url to memory
        async with httpx.AsyncClient() as client:
            resp = await client.get(resume.file_url)
            resp.raise_for_status()
            pdf_content = resp.content
            
        # Extract HTML
        from app.services import html_service
        html_code = await html_service.extract_html_from_pdf(pdf_content)
        
        # Save to DB
        resume.html_code = html_code
        await resume.save()
        
        return {"html_code": html_code}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class CompileRequest(BaseModel):
    latex_code: str

@router.post("/compile")
async def compile_latex(req: CompileRequest, user: User = Depends(get_current_user)):
    """Compile LaTeX to PDF and return as bytes."""
    try:
        pdf_bytes = await latex_service.compile_latex_to_pdf(req.latex_code)
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auto-apply")
async def auto_apply_tailor(req: TailorRequest, user: User = Depends(get_current_user)):
    """Apply recommendations to a resume, compile, and email the PDF to the user."""
    try:
        resume = await Resume.get(PydanticObjectId(req.resume_id))
        if not resume or resume.user_id != user.id:
            raise HTTPException(status_code=404, detail="Resume not found")
            
        latex_code = resume.latex_code
        
        # If not extracted yet, extract it first
        if not latex_code:
            async with httpx.AsyncClient() as client:
                resp = await client.get(resume.file_url)
                resp.raise_for_status()
                pdf_content = resp.content
            latex_code = await latex_service.extract_latex_from_pdf(pdf_content)
            resume.latex_code = latex_code
            await resume.save()
            
        # Tailor LaTeX via AI
        new_latex = await ai_service.tailor_resume_latex(
            latex_code, 
            req.recommendations, 
            req.custom_instructions
        )
        
        # Persist updated LaTeX
        resume.latex_code = new_latex
        await resume.save()
        
        # Compile to PDF
        pdf_bytes = await latex_service.compile_latex_to_pdf(new_latex)
        
        # Email the PDF to the user
        safe_filename = f"tailored_{resume.filename or 'resume'}"
        if not safe_filename.endswith(".pdf"):
            safe_filename += ".pdf"

        email_sent = await send_tailored_resume_email(
            to_email=user.email,
            pdf_bytes=pdf_bytes,
            filename=safe_filename,
        )

        if not email_sent:
            logger.warning("Tailored resume compiled but email delivery failed for user %s", user.email)
            return {
                "message": "Resume tailored successfully but email delivery failed. Please download it manually.",
                "latex_code": new_latex,
                "email_sent": False,
            }

        logger.info("Tailored resume emailed to %s (%s)", user.email, safe_filename)
        return {
            "message": f"Resume tailored and emailed to {user.email} successfully.",
            "latex_code": new_latex,
            "email_sent": True,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
