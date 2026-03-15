from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone

from backend.database import get_db
from backend.auth import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    phone_number: Optional[str] = None
    current_city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    street: Optional[str] = None
    zipcode: Optional[str] = None
    linkedin_profile: Optional[str] = None
    website: Optional[str] = None
    linkedin_headline: Optional[str] = None
    linkedin_summary: Optional[str] = None
    cover_letter: Optional[str] = None
    skills_summary: Optional[str] = None
    years_of_experience: Optional[str] = "0"
    gender: Optional[str] = ""
    ethnicity: Optional[str] = ""
    disability_status: Optional[str] = "Decline"
    veteran_status: Optional[str] = "Decline"
    desired_salary: Optional[int] = None
    current_ctc: Optional[int] = 0
    notice_period: Optional[int] = 0
    recent_employer: Optional[str] = None
    confidence_level: Optional[str] = "7"
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = "gemini-2.0-flash"
    education_text: Optional[str] = None
    experience_text: Optional[str] = None


class JobPreferences(BaseModel):
    search_terms: Optional[List[str]] = []
    search_location: Optional[str] = "India"
    experience_level: Optional[List[str]] = ["Entry level"]
    job_type: Optional[List[str]] = ["Full-time"]
    on_site: Optional[List[str]] = ["On-site", "Hybrid", "Remote"]
    date_posted: Optional[str] = "Past month"
    sort_by: Optional[str] = "Most recent"
    switch_number: Optional[int] = 15
    easy_apply_only: Optional[bool] = True
    bad_words: Optional[List[str]] = []
    good_words: Optional[List[str]] = []
    require_visa: Optional[str] = "No"
    us_citizenship: Optional[str] = "Other"


class PlatformAccounts(BaseModel):
    linkedin_email: Optional[str] = None
    linkedin_password: Optional[str] = None
    indeed_email: Optional[str] = None
    indeed_password: Optional[str] = None
    internshala_email: Optional[str] = None
    internshala_password: Optional[str] = None
    naukri_email: Optional[str] = None
    naukri_password: Optional[str] = None


@router.get("/me")
async def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(404, detail="User not found")

    return {
        "email": user.get("email"),
        "profile": user.get("profile", {}),
        "job_preferences": user.get("job_preferences", {}),
        "platform_accounts": _mask_passwords(user.get("platform_accounts", {})),
        "resume_count": len(user.get("resumes", [])),
    }


@router.put("/update")
async def update_profile(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {"profile": data}}
    )
    return {"message": "Profile updated successfully"}


@router.put("/job-preferences")
async def update_job_preferences(body: JobPreferences, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {"job_preferences": body.model_dump()}}
    )
    return {"message": "Job preferences saved"}


@router.put("/platform-accounts")
async def update_platform_accounts(body: PlatformAccounts, current_user: dict = Depends(get_current_user)):
    db = get_db()
    data = {}
    for k, v in body.model_dump().items():
        if v is None:
            continue
        if "password" in k and (not v or len(v.strip()) == 0):
            continue
        data[k] = v

    if data:
        await db.users.update_one(
            {"_id": ObjectId(current_user["user_id"])},
            {"$set": {f"platform_accounts.{k}": v for k, v in data.items()}}
        )
    return {"message": "Platform accounts saved"}


def _mask_passwords(accounts: dict) -> dict:
    masked = dict(accounts)
    for key in list(masked.keys()):
        if "password" in key and masked[key]:
            masked[key] = "••••••••"
    return masked
