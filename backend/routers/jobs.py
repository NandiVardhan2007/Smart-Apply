from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone

from backend.database import get_db
from backend.auth import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


class ApplicationLog(BaseModel):
    platform: str
    job_title: str
    company: str
    job_link: Optional[str] = None
    result: str  # "Applied", "Failed", "Skipped", "Dry Run"
    reason: Optional[str] = None


@router.post("/log")
async def log_application(
    body: ApplicationLog,
    current_user: dict = Depends(get_current_user),
):
    """Log a job application submitted by the Chrome extension."""
    db = get_db()
    doc = {
        "user_id": current_user["user_id"],
        "platform": body.platform,
        "job_title": body.job_title,
        "company": body.company,
        "job_link": body.job_link,
        "result": body.result,
        "reason": body.reason,
        "applied_at": datetime.now(timezone.utc),
    }
    result = await db.applications.insert_one(doc)
    return {"message": "Logged", "id": str(result.inserted_id)}


@router.get("/history")
async def get_history(
    skip: int = 0,
    limit: int = 50,
    platform: Optional[str] = None,
    result: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"user_id": current_user["user_id"]}
    if platform:
        query["platform"] = platform
    if result:
        query["result"] = result

    total = await db.applications.count_documents(query)
    cursor = db.applications.find(query).sort("applied_at", -1).skip(skip).limit(limit)
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["applied_at"] = (
            doc["applied_at"].isoformat()
            if hasattr(doc["applied_at"], "isoformat")
            else str(doc["applied_at"])
        )
        docs.append(doc)

    return {"total": total, "applications": docs}


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["user_id"]

    pipeline = [
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$result", "count": {"$sum": 1}}},
    ]
    result = {}
    async for doc in db.applications.aggregate(pipeline):
        result[doc["_id"]] = doc["count"]

    platform_pipeline = [
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
    ]
    platforms = {}
    async for doc in db.applications.aggregate(platform_pipeline):
        platforms[doc["_id"]] = doc["count"]

    total = sum(result.values())
    return {
        "total": total,
        "applied": result.get("Applied", 0),
        "failed": result.get("Failed", 0),
        "skipped": result.get("Skipped", 0),
        "by_platform": platforms,
    }


@router.get("/extension/download")
async def download_extension(current_user: dict = Depends(get_current_user)):
    """Serve the SmartApply Chrome extension as a downloadable zip."""
    import zipfile
    import io
    from fastapi.responses import StreamingResponse
    from pathlib import Path

    ext_dir = Path(__file__).parent.parent.parent / "extension"
    if not ext_dir.exists():
        raise HTTPException(status_code=404, detail="Extension not found on server.")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in ext_dir.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(ext_dir))
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=smartapply-extension.zip"},
    )
