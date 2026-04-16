from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from typing import List
from bson import ObjectId
from app.db.mongodb import get_database
from app.core.admin_security import get_current_admin_user
from app.schemas.user import UserOut
from app.schemas.admin import AdminMetrics, BanUserRequest, AuditLog
from app.services.admin_service import admin_service

router = APIRouter(dependencies=[Depends(get_current_admin_user)])

@router.get("/metrics/dashboard", response_model=AdminMetrics)
async def get_admin_dashboard():
    metrics = await admin_service.get_dashboard_metrics()
    return AdminMetrics(**metrics)

@router.get("/users", response_model=List[UserOut])
async def get_all_users(skip: int = 0, limit: int = 50):
    db = get_database()
    cursor = db.users.find({}).skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)
    
    for u in users:
        u["id"] = str(u["_id"])
        
    return [UserOut(**u) for u in users]

@router.get("/users/{user_id}", response_model=UserOut)
async def get_user_details(user_id: str):
    db = get_database()
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user["id"] = str(user["_id"])
    return UserOut(**user)

@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str, 
    request: BanUserRequest, 
    background_tasks: BackgroundTasks,
    current_admin: dict = Depends(get_current_admin_user)
):
    db = get_database()
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent banning other admins for safety
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot ban another admin")
        
    # Toggle ban status
    new_ban_status = not user.get("is_banned", False)
    
    await db.users.update_one(
        {"_id": user_obj_id}, 
        {"$set": {"is_banned": new_ban_status, "ban_reason": request.reason}}
    )

    action = "user_banned" if new_ban_status else "user_unbanned"
    background_tasks.add_task(
        admin_service.log_admin_action,
        admin_id=str(current_admin["_id"]),
        action=action,
        entity_id=user_id,
        metadata={"reason": request.reason, "target_email": user.get("email")}
    )

    return {"message": f"User successfully {'banned' if new_ban_status else 'unbanned'}"}

@router.get("/system/logs")
async def get_audit_logs(skip: int = 0, limit: int = 100):
    db = get_database()
    # Sort by newest first
    cursor = db.audit_logs.find({}).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    
    for log in logs:
        log["id"] = str(log["_id"])
        
    return logs

@router.get("/emails")
async def get_email_logs(skip: int = 0, limit: int = 50):
    logs = await admin_service.get_email_logs(skip, limit)
    return logs

@router.get("/feedbacks")
async def get_feedbacks(skip: int = 0, limit: int = 50):
    feedbacks = await admin_service.get_feedbacks(skip, limit)
    return feedbacks

@router.post("/feedbacks/{feedback_id}/reply")
async def reply_to_feedback(feedback_id: str, data: dict):
    message = data.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
        
    success = await admin_service.reply_to_feedback(feedback_id, message)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send reply")
        
    return {"message": "Reply sent successfully"}
