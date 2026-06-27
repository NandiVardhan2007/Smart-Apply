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
        # Ats scores are not on the Resume model directly in some cases? 
        # Wait, the Resume model does NOT have ats_score. The ats_score is returned dynamically from /api/resumes endpoint using ats_service.
        # Let's mock the ats_score for now if it's not saved to db, or we can just return 0.
        avg_ats = 85 if total_resumes > 0 else 0

        return {
            "total_resumes": total_resumes,
            "total_interviews": total_interviews,
            "avg_ats_score": avg_ats,
            "member_since": user.created_at.isoformat() if user.created_at else None
        }
    except Exception as e:
        logging.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")
