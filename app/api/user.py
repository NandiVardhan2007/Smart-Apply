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

async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user_id = payload.get("sub")
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["id"] = str(user["_id"])
    return user

@router.get("/profile", response_model=UserOut)
async def get_profile(current_user: dict = Depends(get_current_user)):
    if current_user.get("profile_pic_url"):
        key = storage_service.get_key_from_url(current_user["profile_pic_url"])
        presigned_url = storage_service.generate_presigned_url(key)
        if presigned_url:
            current_user["profile_pic_url"] = presigned_url
            
    return UserOut(**current_user)

@router.put("/profile", response_model=UserOut)
async def update_profile(profile_update: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    update_data = {k: v for k, v in profile_update.dict().items() if v is not None}
    
    if update_data:
        update_data["is_profile_completed"] = True
        await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": update_data})
        current_user.update(update_data)
        
    return UserOut(**current_user)

@router.post("/upload-avatar", status_code=status.HTTP_201_CREATED)
async def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_content = await file.read()
    file_name = f"avatars/{current_user['id']}_{file.filename}"
    url = storage_service.upload_file(file_content, file_name, file.content_type)
    
    if not url:
        raise HTTPException(status_code=500, detail="Error uploading file to storage")
        
    db = get_database()
    await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": {"profile_pic_url": url}})
    
    # Return presigned URL for immediate display
    presigned_url = storage_service.generate_presigned_url(file_name)
    return {"url": presigned_url or url}

@router.post("/upload-resume", status_code=status.HTTP_201_CREATED)
async def upload_resume(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_content = await file.read()
    file_name = f"resumes/{current_user['id']}_{file.filename}"
    url = storage_service.upload_file(file_content, file_name, file.content_type)
    
    if not url:
        raise HTTPException(status_code=500, detail="Error uploading file to storage")
        
    db = get_database()
    await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": {"resume_url": url}})
    return {"url": url}

@router.get("/dashboard")
async def get_dashboard_data(current_user: dict = Depends(get_current_user)):
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

    return {
        "user": {
            "full_name": current_user.get("full_name") or current_user.get("first_name", "User"),
            "resume_url": current_user.get("resume_url")
        },
        "stats": {
            "total_applications": total_apps,
            "pending_responses": pending_apps,
            "completed": completed_apps,
            "response_rate": response_rate
        },
        "recent_applications": recent_apps
    }

@router.get("/ats-results")
async def get_ats_results(current_user: dict = Depends(get_current_user)):
    # Mock analysis based on user skills for now, since we haven't stored scans yet
    skills = current_user.get("skills", "")
    score = 85 if skills else 40
    
    return {
        "overall_score": score,
        "status": "Excellent" if score > 80 else "Good",
        "description": "Your resume is highly optimized for technical roles." if score > 80 else "Add more technical keywords.",
        "details": {
            "experience": "92%",
            "education": "100%"
        },
        "missing_keywords": ["CI/CD Pipelines", "Kubernetes", "Clean Architecture"] if not "CI/CD" in skills else ["Cloud Optimization"],
    }

@router.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # 1. Read file
    file_content = await file.read()
    
    # 2. Extract Text
    text = extract_text_from_pdf(file_content)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
    # 3. Parse with AI (NVIDIA NIM)
    print(f"DEBUG: Extracting text from PDF, length: {len(text)}")
    parsed_data = await parse_resume_with_ai(text)
    print(f"DEBUG: Parsed data from AI: {parsed_data}")
    
    return parsed_data
