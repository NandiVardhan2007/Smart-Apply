from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone

from backend.database import get_db
from backend.auth import get_current_user
from backend.services.bot_service import start_bot_session, stop_bot_session, get_bot_status

router = APIRouter(prefix="/jobs", tags=["jobs"])


class ApplicationLog(BaseModel):
    platform: str
    job_title: str
    company: str
    job_link: Optional[str] = None
    result: str  # "Applied", "Failed", "Skipped"
    reason: Optional[str] = None


class BotStartRequest(BaseModel):
    platform: str = "linkedin"
    resume_file_id: Optional[str] = None


@router.post("/log")
async def log_application(body: ApplicationLog, current_user: dict = Depends(get_current_user)):
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
        doc["applied_at"] = doc["applied_at"].isoformat() if hasattr(doc["applied_at"], "isoformat") else str(doc["applied_at"])
        docs.append(doc)

    return {"total": total, "applications": docs}


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["user_id"]

    pipeline = [
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$result", "count": {"$sum": 1}}}
    ]
    result = {}
    async for doc in db.applications.aggregate(pipeline):
        result[doc["_id"]] = doc["count"]

    platform_pipeline = [
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}}
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


@router.post("/bot/start")
async def start_bot(
    body: BotStartRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(404, detail="User not found")

    profile = user.get("profile", {})
    if not profile.get("first_name"):
        raise HTTPException(400, detail="Complete your profile before starting automation")

    platform_accounts = user.get("platform_accounts", {})
    if body.platform == "linkedin":
        li_email = (platform_accounts.get("linkedin_email") or "").strip()
        li_pass  = (platform_accounts.get("linkedin_password") or "").strip()
        if not li_email:
            raise HTTPException(400, detail="LinkedIn email not set — go to Profile → Platform Logins")
        if len(li_pass) < 5:
            raise HTTPException(400, detail="LinkedIn password is missing or too short — go to Profile → Platform Logins and re-enter it")

    job_prefs = user.get("job_preferences", {})
    search_terms = (job_prefs.get("search_terms") or [])
    if not search_terms:
        raise HTTPException(400, detail="No job search terms set — go to Profile → Job Preferences and add at least one job title")
    resume_list = user.get("resumes", [])

    background_tasks.add_task(
        start_bot_session,
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        platform=body.platform,
        profile=profile,
        platform_accounts=platform_accounts,
        job_prefs=job_prefs,
        resume_file_id=body.resume_file_id or (resume_list[0]["file_id"] if resume_list else None),
    )

    return {"message": f"Bot starting for {body.platform}. Check dashboard for status."}


@router.post("/bot/stop")
async def stop_bot(current_user: dict = Depends(get_current_user)):
    stopped = await stop_bot_session(current_user["user_id"])
    return {"message": "Bot stopped" if stopped else "No active bot session"}


@router.get("/bot/status")
async def bot_status(current_user: dict = Depends(get_current_user)):
    status = await get_bot_status(current_user["user_id"])
    return status


@router.get("/bot/logs")
async def bot_logs(
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """
    Poll bot log file for new lines since `offset` (byte position).
    Returns { lines: [...], next_offset: int }
    """
    import os
    from pathlib import Path

    user_id = current_user["user_id"]
    ws = Path(os.path.expanduser("~")) / ".smartapply" / "workspaces" / user_id
    log_path = ws / "logs" / "log.txt"

    lines = []
    next_offset = offset

    if log_path.exists():
        file_size = log_path.stat().st_size
        if offset > file_size:
            offset = 0
        if file_size > offset:
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(offset)
                chunk = f.read(32768)
                next_offset = f.tell()
                lines = [ln for ln in chunk.splitlines() if ln.strip()]

    return {"lines": lines, "next_offset": next_offset}
