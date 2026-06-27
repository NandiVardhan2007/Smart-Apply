from typing import List

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request
from app.rate_limiter import limiter
from beanie import PydanticObjectId

from app.middleware.auth_middleware import get_current_user
from app.models.resume import Resume
from app.models.user import User
from app.services import storage_service

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

ALLOWED_RESUME_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("")
@limiter.limit("5/minute")
async def upload_new_resume(
    request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)
):
    """Upload a new resume, extract its text, and save it to the library."""
    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10 MB limit")

    # Extract text from PDF
    try:
        doc = fitz.open(stream=contents, filetype="pdf")
        resume_text = ""
        for page in doc:
            resume_text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")

    if not resume_text.strip():
        raise HTTPException(
            status_code=400, detail="Could not extract text from the PDF. It may be an image."
        )

    # Upload to R2
    key = storage_service.upload_file(
        file_bytes=contents,
        original_filename=file.filename or "resume.pdf",
        folder=f"resumes/{user.id}",
        content_type=file.content_type or "application/pdf",
    )
    url = storage_service.get_file_url(key)

    # Check if this is their first resume
    existing_count = await Resume.find({"user_id": user.id}).count()
    is_primary = existing_count == 0

    # Save to Resume collection
    resume = Resume(
        user_id=user.id,
        filename=file.filename or "resume.pdf",
        file_url=url,
        extracted_text=resume_text,
        is_primary=is_primary,
    )
    await resume.insert()

    # If it's primary, update the User model for legacy fallback
    if is_primary:
        user.resume_url = url
        await user.save()

    return {"message": "Resume uploaded successfully", "resume": resume}


@router.get("")
@limiter.limit("20/minute")
async def list_resumes(request: Request, user: User = Depends(get_current_user)):
    """List all resumes uploaded by the user."""
    resumes = await Resume.find({"user_id": user.id}).sort("-uploaded_at").to_list()
    return {"resumes": resumes}


@router.delete("/{resume_id}")
@limiter.limit("10/minute")
async def delete_resume(request: Request, resume_id: str, user: User = Depends(get_current_user)):
    """Delete a resume from the library."""
    try:
        resume = await Resume.get(PydanticObjectId(resume_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Resume ID")
        
    if not resume or resume.user_id != user.id:
        raise HTTPException(status_code=404, detail="Resume not found")

    await resume.delete()
    return {"message": "Resume deleted successfully"}
