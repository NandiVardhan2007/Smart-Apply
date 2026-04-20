"""
ATS Analysis API Router
Handles resume scanning, history retrieval, and scan detail lookups.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from typing import Optional
from app.api.user import get_current_user
from app.core.config import settings
from app.db.mongodb import get_database
from app.services.pdf_handler import extract_text_from_pdf
from app.services.ats_analyzer import analyze_resume_ats, is_resume
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()


@router.post("/scan", status_code=status.HTTP_201_CREATED)
async def scan_resume(
    file: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    job_title: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a resume PDF and optionally a job description.
    Runs a comprehensive AI-powered ATS analysis and persists the results.
    """
    # 1. Validate file extension
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported for ATS analysis."
        )
    
    # 2. Extract text from PDF
    file_content = await file.read()
    if len(file_content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {settings.MAX_UPLOAD_BYTES // (1024*1024)}MB."
        )
    resume_text = extract_text_from_pdf(file_content)
    
    # 3. Strict Resume Content Validation
    if not is_resume(resume_text):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded document does not appear to be a resume. Please upload a professional resume file (PDF) containing your experience, skills, and education."
        )
    
    # 3. Run AI analysis
    analysis_result = await analyze_resume_ats(
        resume_text=resume_text,
        job_description=job_description,
        file_bytes=file_content
    )
    
    # 4. Build scan document for persistence
    scan_doc = {
        "user_id": str(current_user["id"]),
        "filename": file.filename,
        "job_title": job_title or "General Analysis",
        "job_description_provided": bool(job_description and job_description.strip()),
        "resume_text_length": len(resume_text),
        "overall_score": analysis_result.get("overall_score", 0),
        "overall_grade": analysis_result.get("overall_grade", "N/A"),
        "summary": analysis_result.get("summary", ""),
        "categories": analysis_result.get("categories", []),
        "milestones": analysis_result.get("milestones", []),
        "drawbacks": analysis_result.get("drawbacks", []),
        "improvement_plan": analysis_result.get("improvement_plan", []),
        "created_at": datetime.now(timezone.utc),
    }
    
    # 5. Persist to MongoDB
    db = get_database()
    result = await db.ats_scans.insert_one(scan_doc)
    scan_doc["id"] = str(result.inserted_id)
    
    # 6. Retention Policy: Keep only the most recent 3 scans per user
    user_id = scan_doc["user_id"]
    cursor = db.ats_scans.find({"user_id": user_id}).sort("created_at", -1)
    all_scans = await cursor.to_list(length=100)
    
    if len(all_scans) > 3:
        # Identify IDs to delete (everything beyond the first 3)
        ids_to_delete = [s["_id"] for s in all_scans[3:]]
        await db.ats_scans.delete_many({"_id": {"$in": ids_to_delete}})
    
    # Remove MongoDB _id for JSON serialization
    scan_doc.pop("_id", None)
    
    return scan_doc


@router.get("/history")
async def get_scan_history(current_user: dict = Depends(get_current_user)):
    """
    Returns the last 3 ATS scan results for the current user.
    Only returns summary-level data (not full category details) for performance.
    """
    db = get_database()
    cursor = db.ats_scans.find(
        {"user_id": str(current_user["id"])},
        {
            "_id": 1,
            "filename": 1,
            "job_title": 1,
            "overall_score": 1,
            "overall_grade": 1,
            "summary": 1,
            "job_description_provided": 1,
            "created_at": 1,
        }
    ).sort("created_at", -1).limit(3)
    
    history = []
    async for scan in cursor:
        scan["id"] = str(scan["_id"])
        del scan["_id"]
        # Serialize datetime to ISO string
        if isinstance(scan.get("created_at"), datetime):
            scan["created_at"] = scan["created_at"].isoformat()
        history.append(scan)
    
    return {"scans": history, "total": len(history)}


@router.get("/scan/{scan_id}")
async def get_scan_detail(scan_id: str, current_user: dict = Depends(get_current_user)):
    """
    Returns the full details of a specific ATS scan.
    Validates that the scan belongs to the current user.
    """
    db = get_database()
    
    try:
        scan = await db.ats_scans.find_one({"_id": ObjectId(scan_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Security: ensure the scan belongs to this user
    if scan.get("user_id") != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    scan["id"] = str(scan["_id"])
    del scan["_id"]
    
    # Serialize datetime
    if isinstance(scan.get("created_at"), datetime):
        scan["created_at"] = scan["created_at"].isoformat()
    
    return scan
