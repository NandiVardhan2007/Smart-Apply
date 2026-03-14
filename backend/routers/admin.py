"""
admin.py  — Admin-only API endpoints.

In production you'd add proper admin role checking.
For now the endpoints are JWT-protected (any logged-in user).
Add role: "admin" field to user doc and check it here for production use.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
import json
from pathlib import Path

from backend.database import get_db
from backend.auth import get_current_user
from backend.config import NVIDIA_API_KEYS, NVIDIA_MODEL, SMTP_USER
from backend.email_utils import send_verification_email

router = APIRouter(prefix="/admin", tags=["admin"])

_ADMIN_CFG = Path(__file__).parent.parent.parent / "admin_config.json"


def _load_cfg() -> dict:
    if _ADMIN_CFG.exists():
        try:
            return json.loads(_ADMIN_CFG.read_text())
        except Exception:
            pass
    return {}


def _save_cfg(data: dict):
    _ADMIN_CFG.write_text(json.dumps(data, indent=2))


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cfg = _load_cfg()

    total_users        = await db.users.count_documents({})
    total_applications = await db.applications.count_documents({})
    active_sessions    = await db.bot_sessions.count_documents({"status": "running"})

    return {
        "total_users": total_users,
        "total_applications": total_applications,
        "active_sessions": active_sessions,
        "nvidia_keys": len(NVIDIA_API_KEYS),
        "smtp_configured": bool(cfg.get("smtp_user") or SMTP_USER),
        "smtp_user": cfg.get("smtp_user") or SMTP_USER or "",
    }


# ── SMTP ──────────────────────────────────────────────────────────────────────

class SMTPConfig(BaseModel):
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str
    smtp_pass: str


class TestEmailRequest(BaseModel):
    to: EmailStr


@router.put("/smtp")
async def update_smtp(body: SMTPConfig, current_user: dict = Depends(get_current_user)):
    cfg = _load_cfg()
    cfg.update({
        "smtp_host": body.smtp_host,
        "smtp_port": str(body.smtp_port),
        "smtp_user": body.smtp_user,
        "smtp_pass": body.smtp_pass,
    })
    _save_cfg(cfg)

    # Reload config module vars live
    import backend.config as c
    c.SMTP_HOST = body.smtp_host
    c.SMTP_PORT = body.smtp_port
    c.SMTP_USER = body.smtp_user
    c.SMTP_PASS = body.smtp_pass
    c.SMTP_FROM = f"SmartApply <{body.smtp_user}>"

    return {"message": "SMTP configuration saved"}


@router.post("/smtp/test")
async def test_smtp(body: TestEmailRequest, current_user: dict = Depends(get_current_user)):
    try:
        await send_verification_email(body.to, "123456")
        return {"message": f"Test email sent to {body.to}"}
    except Exception as e:
        raise HTTPException(500, detail=f"SMTP error: {e}")


# ── NVIDIA API Keys ───────────────────────────────────────────────────────────

class KeysUpdate(BaseModel):
    keys: list[str]
    model: Optional[str] = None


@router.get("/keys")
async def get_keys(current_user: dict = Depends(get_current_user)):
    cfg = _load_cfg()
    all_keys = cfg.get("nvidia_keys") or NVIDIA_API_KEYS
    return {
        "keys": all_keys,
        "model": cfg.get("nvidia_model") or NVIDIA_MODEL,
    }


@router.put("/keys")
async def update_keys(body: KeysUpdate, current_user: dict = Depends(get_current_user)):
    # Validate format
    for k in body.keys:
        if not k.startswith("nvapi-"):
            raise HTTPException(400, detail=f"Invalid key format: {k[:20]}…")

    cfg = _load_cfg()
    cfg["nvidia_keys"] = body.keys
    if body.model:
        cfg["nvidia_model"] = body.model
    _save_cfg(cfg)

    # Update live
    import backend.config as c
    c.NVIDIA_API_KEYS.clear()
    c.NVIDIA_API_KEYS.extend(body.keys)
    if body.model:
        c.NVIDIA_MODEL = body.model

    return {"message": f"Saved {len(body.keys)} keys"}


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    users = []
    async for doc in db.users.find({}, {
        "email": 1, "is_verified": 1, "profile": 1,
        "resumes": 1, "created_at": 1
    }).sort("created_at", -1).skip(skip).limit(limit):

        # Count apps
        app_count = await db.applications.count_documents({"user_id": str(doc["_id"])})

        users.append({
            "id": str(doc["_id"]),
            "email": doc.get("email"),
            "is_verified": doc.get("is_verified", False),
            "has_profile": bool(doc.get("profile", {}).get("first_name")),
            "resume_count": len(doc.get("resumes", [])),
            "app_count": app_count,
            "created_at": doc["created_at"].isoformat() if hasattr(doc.get("created_at"), "isoformat") else str(doc.get("created_at", "")),
        })

    return {"users": users, "total": len(users)}


@router.post("/users/{user_id}/verify")
async def force_verify_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Manually verify a user's email — useful when email delivery fails."""
    db = get_db()
    from bson import ObjectId
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_verified": True}, "$unset": {"verification_pin": "", "pin_expires": "", "pin_attempts": ""}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, detail="User not found")
    return {"message": "User verified successfully"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user account."""
    db = get_db()
    from bson import ObjectId
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, detail="User not found")
    return {"message": "User deleted"}