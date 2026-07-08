from fastapi import APIRouter, Depends, Request, HTTPException
from typing import List, Dict, Any
from app.middleware.admin_middleware import get_admin_user
from app.models.user import User
from app.models.resume import Resume
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
