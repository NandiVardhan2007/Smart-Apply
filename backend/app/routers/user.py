from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.models.interview_report import InterviewReport
from app.schemas.auth import (
    ChangePasswordRequest,
    MessageResponse,
    ProfileUpdateRequest,
)
from app.services.auth_service import hash_password, verify_password
from app.services import storage_service

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/profile")
async def get_profile(user: User = Depends(get_current_user)):
    """Get the current user's profile."""
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "bio": user.bio,
        "skills": user.skills,
        "linkedin_url": user.linkedin_url,
        "github_url": user.github_url,
        "portfolio_url": user.portfolio_url,
        "education": user.education,
        "experience": user.experience,
        "profile_pic_url": user.profile_pic_url,
        "resume_url": user.resume_url,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.put("/profile")
async def update_profile(
    body: ProfileUpdateRequest, user: User = Depends(get_current_user)
):
    """Update the current user's profile fields."""
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.phone is not None:
        user.phone = body.phone
    if body.bio is not None:
        user.bio = body.bio
    if body.skills is not None:
        user.skills = body.skills
    if body.linkedin_url is not None:
        user.linkedin_url = body.linkedin_url
    if body.github_url is not None:
        user.github_url = body.github_url
    if body.portfolio_url is not None:
        user.portfolio_url = body.portfolio_url
    if body.education is not None:
        user.education = body.education
    if body.experience is not None:
        user.experience = body.experience

    await user.save()
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "bio": user.bio,
            "skills": user.skills,
            "linkedin_url": user.linkedin_url,
            "github_url": user.github_url,
            "portfolio_url": user.portfolio_url,
            "education": user.education,
            "experience": user.experience,
            "profile_pic_url": user.profile_pic_url,
            "is_verified": user.is_verified,
        }
    }


@router.put("/settings/password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest, user: User = Depends(get_current_user)
):
    """Change the current user's password."""
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(body.new_password)
    await user.save()
    return MessageResponse(message="Password changed successfully")


@router.delete("/account", response_model=MessageResponse)
async def delete_account(user: User = Depends(get_current_user)):
    """Delete the current user's account and all associated data.

    The Settings page tells the user this erases "your data, resumes, and
    interview history" — this needs to actually do that, not just remove the
    User document and leave everything else (resume files in R2, resume
    records, interview reports) orphaned behind.
    """
    resumes = await Resume.find(Resume.user_id == user.id).to_list()
    for resume in resumes:
        if resume.file_key:
            try:
                await run_in_threadpool(storage_service.delete_file, resume.file_key)
            except Exception:
                # Don't let a storage hiccup block the rest of account deletion
                pass
        await resume.delete()

    await InterviewReport.find(InterviewReport.user_id == str(user.id)).delete()

    await user.delete()
    return MessageResponse(message="Account deleted successfully")
