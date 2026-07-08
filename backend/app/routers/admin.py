from fastapi import APIRouter, Depends, Request
from typing import List, Dict, Any
from app.middleware.admin_middleware import get_admin_user
from app.models.user import User
from app.models.resume import Resume

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
