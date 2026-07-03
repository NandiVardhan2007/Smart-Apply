from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request
from app.rate_limiter import limiter
from starlette.concurrency import run_in_threadpool

from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.services import storage_service

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Note: resume uploads go through POST /api/resumes (see routers/resume.py), which
# also extracts text and manages the resume library. A duplicate, unused
# POST /api/upload/resume endpoint previously lived here and has been removed.


@router.post("/avatar")
@limiter.limit("5/minute")
async def upload_avatar(
    request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)
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
