import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.models.interview_report import InterviewReport

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/dashboard")
async def get_dashboard_stats(user: User = Depends(get_current_user)):
    try:
        # Aggregation pipeline to compute average ATS score directly in MongoDB engine
        ats_pipeline = [
            {"$match": {"user_id": user.id, "ats_score": {"$ne": None}}},
            {"$group": {"_id": None, "avg_ats": {"$avg": "$ats_score"}}}
        ]

        # Execute queries concurrently to minimize I/O waiting time
        total_resumes_task = Resume.find(Resume.user_id == user.id).count()
        total_interviews_task = InterviewReport.find(InterviewReport.user_id == str(user.id)).count()
        ats_agg_task = Resume.aggregate(ats_pipeline).to_list()

        total_resumes, total_interviews, ats_agg = await asyncio.gather(
            total_resumes_task,
            total_interviews_task,
            ats_agg_task
        )

        avg_ats = 0
        if ats_agg and len(ats_agg) > 0 and ats_agg[0].get("avg_ats") is not None:
            avg_ats = round(ats_agg[0]["avg_ats"])

        return {
            "total_resumes": total_resumes,
            "total_interviews": total_interviews,
            "avg_ats_score": avg_ats,
            "member_since": user.created_at.isoformat() if user.created_at else None
        }
    except Exception as e:
        logging.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")
