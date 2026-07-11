from typing import List

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request, BackgroundTasks
from starlette.concurrency import run_in_threadpool
from app.rate_limiter import limiter
from beanie import PydanticObjectId

from app.middleware.auth_middleware import get_current_user
from app.models.resume import Resume
from app.models.user import User
from app.services import storage_service, ai_service
import filetype
import urllib.parse

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

ALLOWED_RESUME_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("")
@limiter.limit("5/minute")
async def upload_new_resume(
    request: Request, 
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    user: User = Depends(get_current_user)
):
    """Upload a new resume, extract its text, and save it to the library."""
    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10 MB limit")

    kind = filetype.guess(contents)
    if kind is None or kind.mime not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed based on file content")

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

    safe_filename = urllib.parse.quote(file.filename or "resume.pdf")

    # Upload to R2 (runs the blocking boto3 call off the event loop)
    key = await run_in_threadpool(
        storage_service.upload_file,
        file_bytes=contents,
        original_filename=safe_filename,
        folder=f"resumes/{user.id}",
        content_type=kind.mime,
    )
    url = storage_service.get_file_url(key)

    # Check if this is their first resume
    existing_count = await Resume.find({"user_id": user.id}).count()
    is_primary = existing_count == 0

    # Save to Resume collection
    resume = Resume(
        user_id=user.id,
        filename=safe_filename,
        file_url=url,
        file_key=key,
        extracted_text=resume_text,
        is_primary=is_primary,
    )
    await resume.insert()

    # If it's primary, update the User model for legacy fallback
    if is_primary:
        user.resume_url = url
        await user.save()

    async def _populate_parsed_data(r_id: PydanticObjectId, txt: str):
        parsed = await ai_service.parse_resume_for_profile(txt)
        r = await Resume.get(r_id)
        if r:
            r.parsed_data = parsed
            await r.save()
            
    background_tasks.add_task(_populate_parsed_data, resume.id, resume_text)

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

    was_primary = resume.is_primary
    file_key = resume.file_key

    await resume.delete()

    # Clean up the underlying file in R2 so deleted resumes don't linger forever
    if file_key:
        await run_in_threadpool(storage_service.delete_file, file_key)

    # If the deleted resume was primary, promote the most recently uploaded
    # remaining resume so the user always has a primary resume when one exists
    if was_primary:
        next_primary = (
            await Resume.find({"user_id": user.id}).sort("-uploaded_at").first_or_none()
        )
        if next_primary:
            next_primary.is_primary = True
            await next_primary.save()
            user.resume_url = next_primary.file_url
        else:
            user.resume_url = None
        await user.save()

    return {"message": "Resume deleted successfully"}
