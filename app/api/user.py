from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from typing import List, Optional
from app.schemas.user import UserOut, UserProfileUpdate
from app.db.mongodb import get_database
from app.core.security import decode_access_token
from app.services.storage import storage_service
from app.services.pdf_handler import extract_text_from_pdf
from app.services.ai_parser import parse_resume_with_ai
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

from bson.errors import InvalidId
import logging

logger = logging.getLogger(__name__)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user_id = payload.get("sub")
    try:
        user_object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

    db = get_database()
    user = await db.users.find_one({"_id": user_object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["id"] = str(user["_id"])
    return user

@router.get("/profile", response_model=UserOut)
async def get_profile(current_user: dict = Depends(get_current_user)):
    # Presign URLs for R2 resources
    if current_user.get("profile_pic_url"):
        key = storage_service.get_key_from_url(current_user["profile_pic_url"])
        presigned_url = await storage_service.generate_presigned_url(key)
        if presigned_url:
            current_user["profile_pic_url"] = presigned_url
            
    if current_user.get("resume_url"):
        key = storage_service.get_key_from_url(current_user["resume_url"])
        presigned_url = await storage_service.generate_presigned_url(key)
        if presigned_url:
            current_user["resume_url"] = presigned_url
            
    return UserOut(**current_user)

@router.put("/profile", response_model=UserOut)
async def update_profile(profile_update: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    update_data = {k: v for k, v in profile_update.dict().items() if v is not None}
    
    if update_data:
        update_data["is_profile_completed"] = True
        await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": update_data})
        current_user.update(update_data)
        
    # Presign before returning
    if current_user.get("profile_pic_url"):
        key = storage_service.get_key_from_url(current_user["profile_pic_url"])
        p_url = await storage_service.generate_presigned_url(key)
        if p_url: current_user["profile_pic_url"] = p_url

    if current_user.get("resume_url"):
        key = storage_service.get_key_from_url(current_user["resume_url"])
        r_url = await storage_service.generate_presigned_url(key)
        if r_url: current_user["resume_url"] = r_url
        
    return UserOut(**current_user)

@router.post("/upload-avatar", status_code=status.HTTP_201_CREATED)
async def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_content = await file.read()
    file_name = f"avatars/{current_user['id']}_{file.filename}"
    url = await storage_service.upload_file(file_content, file_name, file.content_type)
    
    if not url:
        raise HTTPException(status_code=500, detail="Error uploading file to storage")
        
    db = get_database()
    await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": {"profile_pic_url": url}})
    
    # Return presigned URL for immediate display
    presigned_url = await storage_service.generate_presigned_url(file_name)
    return {"url": presigned_url or url}

@router.post("/upload-resume", status_code=status.HTTP_201_CREATED)
async def upload_resume(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_content = await file.read()
    file_name = f"resumes/{current_user['id']}_{file.filename}"
    url = await storage_service.upload_file(file_content, file_name, file.content_type)
    
    if not url:
        raise HTTPException(status_code=500, detail="Error uploading file to storage")
        
    # Extract and store text content for AI features (like Auto Applier)
    text_content = ""
    try:
        text_content = extract_text_from_pdf(file_content)
    except Exception as e:
        logger.warning(f"Could not extract text from resume: {e}")

    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])}, 
        {"$set": {"resume_url": url, "resume_content": text_content}}
    )
    return {"url": url}

@router.get("/dashboard")
async def get_dashboard_data(current_user: dict = Depends(get_current_user)):
    try:
        db = get_database()
        user_id = str(current_user["id"])
        
        # 1. Get Application Stats
        total_apps = await db.applications.count_documents({"user_id": user_id})
        pending_apps = await db.applications.count_documents({"user_id": user_id, "status": "Pending"})
        completed_apps = await db.applications.count_documents({"user_id": user_id, "status": "Completed"})
        
        # Calculate response rate (mock logic for now if no data)
        response_rate = "0%"
        if total_apps > 0:
            responses = await db.applications.count_documents({"user_id": user_id, "status": {"$in": ["Interviewing", "Offer", "Rejected"]}})
            response_rate = f"{int((responses / total_apps) * 100)}%"

        # 2. Get Recent Applications
        cursor = db.applications.find({"user_id": user_id}).sort("created_at", -1).limit(5)
        recent_apps = []
        async for app in cursor:
            app["id"] = str(app["_id"])
            del app["_id"]
            recent_apps.append(app)

        # Get profile pic URL if exists
        profile_pic_url = current_user.get("profile_pic_url")
        if profile_pic_url:
            key = storage_service.get_key_from_url(profile_pic_url)
            presigned_pic_url = await storage_service.generate_presigned_url(key)
            if presigned_pic_url:
                profile_pic_url = presigned_pic_url

        # Calculate ATS Score (from latest real scan)
        latest_scan = await db.ats_scans.find_one({"user_id": user_id}, sort=[("created_at", -1)])
        ats_score = latest_scan["overall_score"] if latest_scan else 0
        ats_grade = latest_scan["overall_grade"] if latest_scan else "N/A"

        return {
            "user": {
                "full_name": current_user.get("full_name") or current_user.get("first_name", "User"),
                "resume_url": current_user.get("resume_url"),
                "profile_pic_url": profile_pic_url,
                "ats_score": ats_score,
                "ats_grade": ats_grade
            },
            "stats": {
                "total_applications": total_apps,
                "pending_responses": pending_apps,
                "completed": completed_apps,
                "response_rate": response_rate
            },
            "recent_applications": recent_apps
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard data for user {current_user.get('id')}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Dashboard Sync Error: {str(e)}"
        )


@router.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # 1. Read file
    file_content = await file.read()
    
    # 2. Extract Text
    text = extract_text_from_pdf(file_content)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
    # 3. Parse with AI (NVIDIA NIM)
    parsed_data = await parse_resume_with_ai(text)
    
    # 4. Check if it's actually a resume
    if not parsed_data.get("isResume", True):
        raise HTTPException(
            status_code=400, 
            detail="It is not the resume. Please upload the resume"
        )
    
    return parsed_data
