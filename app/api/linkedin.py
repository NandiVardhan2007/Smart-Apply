"""
LinkedIn Profile Optimizer API Router
Handles LinkedIn profile optimization analysis and history.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.user import get_current_user
from app.db.mongodb import get_database
from app.services.linkedin_analyzer import analyze_linkedin_profile
from app.schemas.linkedin import LinkedInOptimizeRequest
from bson import ObjectId
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/optimize", status_code=status.HTTP_201_CREATED)
async def optimize_linkedin_profile(
    request: LinkedInOptimizeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Accepts extracted LinkedIn profile data and runs AI-powered optimization analysis.
    Returns scored categories, strengths, weaknesses, and an improvement plan.
    """
    profile_dict = request.profile_data.model_dump()

    # Basic validation — at minimum we need a name or headline
    if not profile_dict.get("full_name") and not profile_dict.get("headline"):
        raise HTTPException(
            status_code=400,
            detail="Profile data is too sparse. At minimum, a name or headline is required."
        )

    # Run AI analysis
    logger.info(f"[LinkedIn Optimizer] Running analysis for user {current_user['id']}")
    analysis_result = await analyze_linkedin_profile(profile_dict)

    # Persist to MongoDB
    optimization_doc = {
        "user_id": str(current_user["id"]),
        "profile_name": profile_dict.get("full_name", "Unknown"),
        "profile_headline": profile_dict.get("headline", ""),
        "profile_url": profile_dict.get("profile_url", ""),
        "overall_score": analysis_result.get("overall_score", 0),
        "overall_grade": analysis_result.get("overall_grade", "N/A"),
        "summary": analysis_result.get("summary", ""),
        "categories": analysis_result.get("categories", []),
        "strengths": analysis_result.get("strengths", []),
        "weaknesses": analysis_result.get("weaknesses", []),
        "improvement_plan": analysis_result.get("improvement_plan", []),
        "profile_snapshot": {
            "experience_count": len(profile_dict.get("experience", [])),
            "education_count": len(profile_dict.get("education", [])),
            "skills_count": len(profile_dict.get("skills", [])),
            "has_photo": profile_dict.get("has_profile_photo", False),
            "has_banner": profile_dict.get("has_banner_photo", False),
        },
        "created_at": datetime.now(timezone.utc),
    }

    db = get_database()
    result = await db.linkedin_optimizations.insert_one(optimization_doc)
    optimization_doc["id"] = str(result.inserted_id)
    optimization_doc.pop("_id", None)

    # Serialize datetime for JSON
    if isinstance(optimization_doc.get("created_at"), datetime):
        optimization_doc["created_at"] = optimization_doc["created_at"].isoformat()

    return optimization_doc


@router.get("/history")
async def get_optimization_history(current_user: dict = Depends(get_current_user)):
    """
    Returns the last 10 LinkedIn optimization results for the current user.
    """
    db = get_database()
    cursor = db.linkedin_optimizations.find(
        {"user_id": str(current_user["id"])},
        {
            "_id": 1,
            "profile_name": 1,
            "profile_headline": 1,
            "overall_score": 1,
            "overall_grade": 1,
            "summary": 1,
            "created_at": 1,
        }
    ).sort("created_at", -1).limit(10)

    history = []
    async for opt in cursor:
        opt["id"] = str(opt["_id"])
        del opt["_id"]
        if isinstance(opt.get("created_at"), datetime):
            opt["created_at"] = opt["created_at"].isoformat()
        history.append(opt)

    return {"optimizations": history, "total": len(history)}


@router.get("/optimization/{optimization_id}")
async def get_optimization_detail(
    optimization_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the full details of a specific LinkedIn optimization result.
    """
    db = get_database()

    try:
        opt = await db.linkedin_optimizations.find_one({"_id": ObjectId(optimization_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid optimization ID format")

    if not opt:
        raise HTTPException(status_code=404, detail="Optimization result not found")

    if opt.get("user_id") != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    opt["id"] = str(opt["_id"])
    del opt["_id"]

    if isinstance(opt.get("created_at"), datetime):
        opt["created_at"] = opt["created_at"].isoformat()

    return opt
