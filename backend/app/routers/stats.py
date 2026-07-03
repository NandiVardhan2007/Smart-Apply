from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.models.interview_report import InterviewReport
import logging

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/dashboard")
async def get_dashboard_stats(user: User = Depends(get_current_user)):
    try:
        total_resumes = await Resume.find(Resume.user_id == user.id).count()
        total_interviews = await InterviewReport.find(InterviewReport.user_id == str(user.id)).count()
        
        resumes = await Resume.find(Resume.user_id == user.id).to_list()
        scored = [r.ats_score for r in resumes if r.ats_score is not None]
        avg_ats = round(sum(scored) / len(scored)) if scored else 0

        return {
            "total_resumes": total_resumes,
            "total_interviews": total_interviews,
            "avg_ats_score": avg_ats,
            "member_since": user.created_at.isoformat() if user.created_at else None
        }
    except Exception as e:
        logging.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")
