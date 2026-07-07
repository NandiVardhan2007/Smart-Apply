from fastapi import APIRouter, Depends, HTTPException, Form
from typing import Dict, Any, List
from beanie import PydanticObjectId

from app.models.resume import Resume
from app.models.user import User
from app.services import job_service, ai_service
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

@router.post("/matches")
async def get_job_matches(
    query: str = Form(...),
    location: str = Form("us"),
    resume_id: str = Form(...),
    user: User = Depends(get_current_user)
):
    """
    Search for jobs based on a query and score them against the user's resume.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Job search query is required.")

    # 1. Fetch Resume
    try:
        resume = await Resume.get(PydanticObjectId(resume_id))
        if not resume or resume.user_id != user.id:
            raise HTTPException(status_code=404, detail="Resume not found")
        resume_text = resume.extracted_text
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    # 2. Fetch Jobs from JSearch
    raw_jobs = await job_service.search_jobs(query, location)
    if not raw_jobs:
        return {"matches": []}

    # 3. Score Jobs using AI
    try:
        scored_jobs = await ai_service.score_jobs_batch(resume_text, raw_jobs)
        return {"matches": scored_jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scoring jobs: {str(e)}")
