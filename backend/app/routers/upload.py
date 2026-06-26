from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.services import storage_service

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED_RESUME_TYPES = {"application/pdf"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/resume")
async def upload_resume(
    file: UploadFile = File(...), user: User = Depends(get_current_user)
):
    """Upload a resume PDF to Cloudflare R2."""
    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10 MB limit")

    key = storage_service.upload_file(
        file_bytes=contents,
        original_filename=file.filename or "resume.pdf",
        folder=f"resumes/{user.id}",
        content_type=file.content_type or "application/pdf",
    )
    url = storage_service.get_file_url(key)

    # Update user's resume URL
    user.resume_url = url
    await user.save()

    return {"message": "Resume uploaded successfully", "url": url, "key": key}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...), user: User = Depends(get_current_user)
):
    """Upload a profile picture to Cloudflare R2."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, detail="Only JPEG, PNG, WebP, and GIF images are allowed"
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10 MB limit")

    key = await run_in_threadpool(
        storage_service.upload_file,
        file_bytes=contents,
        original_filename=file.filename or "avatar.png",
        folder=f"avatars/{user.id}",
        content_type=file.content_type or "image/png",
    )
    url = storage_service.get_file_url(key)

    # Update user's profile pic URL
    user.profile_pic_url = url
    await user.save()

    return {"message": "Avatar uploaded successfully", "url": url, "key": key}
