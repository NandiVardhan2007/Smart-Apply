import csv
import io
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from app.middleware.admin_middleware import get_admin_user
from app.models.user import User
from app.models.resume import Resume
from app.models.settings import SystemSettings
from pydantic import BaseModel
from beanie import PydanticObjectId
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/stats")
async def get_system_stats(admin: User = Depends(get_admin_user)) -> Dict[str, Any]:
    """Get high level statistics for the application."""
    user_count = await User.count()
    resume_count = await Resume.count()
    
    return {
        "total_users": user_count,
        "total_resumes": resume_count
    }

@router.get("/users")
async def get_all_users(admin: User = Depends(get_admin_user)) -> Dict[str, Any]:
    """Get a list of all registered users."""
    # We will exclude password hashes
    users = await User.find_all().to_list()
    safe_users = []
    for user in users:
        safe_users.append({
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_verified": user.is_verified,
            "is_admin": user.is_admin,
            "created_at": user.created_at
        })
    return {"users": safe_users}

@router.get("/export/users")
async def export_users_csv(admin: User = Depends(get_admin_user)):
    """Export all users as a CSV file."""
    users = await User.find_all().to_list()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["ID", "Email", "Full Name", "Is Verified", "Is Admin", "Created At"])
    
    for user in users:
        writer.writerow([
            str(user.id),
            user.email,
            user.full_name or "",
            "Yes" if user.is_verified else "No",
            "Yes" if user.is_admin else "No",
            user.created_at.isoformat() if user.created_at else ""
        ])
        
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=smartapply_users_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )

class RoleUpdateRequest(BaseModel):
    is_admin: bool

@router.put("/users/{user_id}/role")
async def update_user_role(user_id: PydanticObjectId, req: RoleUpdateRequest, admin: User = Depends(get_admin_user)):
    """Update a user's admin role."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
        
    user.is_admin = req.is_admin
    await user.save()
    
    return {"ok": True, "detail": "User role updated successfully"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: PydanticObjectId, admin: User = Depends(get_admin_user)):
    """Delete a user and their associated resumes."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    await Resume.find({"user_id": user_id}).delete()
    await user.delete()
    
    return {"ok": True, "detail": "User deleted successfully"}

@router.get("/stats/timeline")
async def get_stats_timeline(admin: User = Depends(get_admin_user)):
    """Get user creation and resume upload counts over the last 30 days."""
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    user_pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": {
                "year": {"$year": "$created_at"},
                "month": {"$month": "$created_at"},
                "day": {"$dayOfMonth": "$created_at"}
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}}
    ]
    user_counts = await User.aggregate(user_pipeline).to_list()
    
    resume_pipeline = [
        {"$match": {"uploaded_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": {
                "year": {"$year": "$uploaded_at"},
                "month": {"$month": "$uploaded_at"},
                "day": {"$dayOfMonth": "$uploaded_at"}
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}}
    ]
    resume_counts = await Resume.aggregate(resume_pipeline).to_list()
    
    timeline = {}
    
    for item in user_counts:
        date_str = f"{item['_id']['year']}-{item['_id']['month']:02d}-{item['_id']['day']:02d}"
        if date_str not in timeline:
            timeline[date_str] = {"date": date_str, "users": 0, "resumes": 0}
        timeline[date_str]["users"] = item["count"]
        
    for item in resume_counts:
        date_str = f"{item['_id']['year']}-{item['_id']['month']:02d}-{item['_id']['day']:02d}"
        if date_str not in timeline:
            timeline[date_str] = {"date": date_str, "users": 0, "resumes": 0}
        timeline[date_str]["resumes"] = item["count"]
        
    final_timeline = []
    for i in range(30, -1, -1):
        dt = datetime.utcnow() - timedelta(days=i)
        date_str = dt.strftime("%Y-%m-%d")
        if date_str in timeline:
            final_timeline.append(timeline[date_str])
        else:
            final_timeline.append({"date": date_str, "users": 0, "resumes": 0})
            
    return {"timeline": final_timeline}

class SettingsUpdateRequest(BaseModel):
    maintenance_mode: bool
    allow_new_signups: bool
    openai_api_key: Optional[str] = None

@router.get("/settings")
async def get_settings(admin: User = Depends(get_admin_user)):
    """Get global system settings."""
    settings = await SystemSettings.find_one()
    if not settings:
        settings = SystemSettings()
        await settings.insert()
    return settings

@router.put("/settings")
async def update_settings(req: SettingsUpdateRequest, admin: User = Depends(get_admin_user)):
    """Update global system settings."""
    settings = await SystemSettings.find_one()
    if not settings:
        settings = SystemSettings()
    
    settings.maintenance_mode = req.maintenance_mode
    settings.allow_new_signups = req.allow_new_signups
    settings.openai_api_key = req.openai_api_key
    settings.updated_at = datetime.utcnow()
    await settings.save()
    
    return {"ok": True, "detail": "Settings updated successfully"}

@router.get("/stats/resumes")
async def get_resume_stats(admin: User = Depends(get_admin_user)):
    """Get detailed ATS score distribution."""
    scored_count = await Resume.find({"ats_score": {"$ne": None}}).count()
    unscored_count = await Resume.find({"ats_score": None}).count()
    
    pipeline = [
        {"$match": {"ats_score": {"$ne": None}}},
        {"$project": {
            "bucket": {
                "$switch": {
                    "branches": [
                        {"case": {"$lte": ["$ats_score", 20]}, "then": "0-20"},
                        {"case": {"$lte": ["$ats_score", 40]}, "then": "21-40"},
                        {"case": {"$lte": ["$ats_score", 60]}, "then": "41-60"},
                        {"case": {"$lte": ["$ats_score", 80]}, "then": "61-80"},
                        {"case": {"$lte": ["$ats_score", 100]}, "then": "81-100"}
                    ],
                    "default": "Unknown"
                }
            }
        }},
        {"$group": {"_id": "$bucket", "count": {"$sum": 1}}}
    ]
    
    distribution_results = await Resume.aggregate(pipeline).to_list()
    
    buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for item in distribution_results:
        if item["_id"] in buckets:
            buckets[item["_id"]] = item["count"]
            
    distribution = [{"range": k, "count": v} for k, v in buckets.items()]
    
    return {
        "scored_resumes": scored_count,
        "unscored_resumes": unscored_count,
        "distribution": distribution
    }
