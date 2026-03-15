import asyncio
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import logging

from backend.database import get_db
from backend.auth import hash_password, verify_password, generate_pin, generate_token, create_access_token
from backend.email_utils import send_verification_email, send_reset_email
from backend.utils.email_validator import validate_email_domain
from backend.config import PIN_EXPIRY_MINUTES, RESET_TOKEN_EXPIRY_HRS, MAX_LOGIN_ATTEMPTS

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

_login_attempts: dict[str, list] = {}


def _check_rate_limit(key: str, max_attempts: int = MAX_LOGIN_ATTEMPTS, window_sec: int = 300):
    now = datetime.now(timezone.utc).timestamp()
    attempts = _login_attempts.get(key, [])
    attempts = [t for t in attempts if now - t < window_sec]
    if len(attempts) >= max_attempts:
        raise HTTPException(429, detail=f"Too many attempts. Try again in {window_sec // 60} minutes.")
    attempts.append(now)
    _login_attempts[key] = attempts


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class VerifyRequest(BaseModel):
    email: EmailStr
    pin: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v


class ResendRequest(BaseModel):
    email: EmailStr


@router.post("/signup")
async def signup(body: SignupRequest):
    db = get_db()
    email = body.email.lower()

    valid, err = await validate_email_domain(email)
    if not valid:
        raise HTTPException(400, detail=err)

    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get("is_verified"):
            raise HTTPException(409, detail="Email already registered")
        pin = generate_pin()
        expires = datetime.now(timezone.utc) + timedelta(minutes=PIN_EXPIRY_MINUTES)
        await db.users.update_one(
            {"email": email},
            {"$set": {"verification_pin": pin, "pin_expires": expires, "pin_attempts": 0}}
        )
        asyncio.create_task(_send_verification(email, pin))
        return {"message": "Verification code resent. Please check your email."}

    pin = generate_pin()
    expires = datetime.now(timezone.utc) + timedelta(minutes=PIN_EXPIRY_MINUTES)

    user_doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "user",
        "is_verified": False,
        "verification_pin": pin,
        "pin_expires": expires,
        "pin_attempts": 0,
        "created_at": datetime.now(timezone.utc),
        "profile": {},
        "resumes": [],
        "platform_accounts": {},
        "job_preferences": {},
    }

    await db.users.insert_one(user_doc)
    asyncio.create_task(_send_verification(email, pin))
    return {"message": "Account created. Check your email for the verification code."}


async def _send_verification(email: str, pin: str):
    try:
        await send_verification_email(email, pin)
    except Exception as exc:
        logger.error(f"[signup] Email send failed for {email}: {exc}")


async def _send_reset(email: str, token: str):
    try:
        await send_reset_email(email, token)
    except Exception as exc:
        logger.error(f"[reset] Email send failed for {email}: {exc}")


@router.post("/verify")
async def verify_email(body: VerifyRequest):
    db = get_db()
    email = body.email.lower()

    _check_rate_limit(f"verify:{email}", max_attempts=5, window_sec=900)

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, detail="Account not found")
    if user.get("is_verified"):
        return {"message": "Already verified. You can log in."}

    attempts = user.get("pin_attempts", 0)
    if attempts >= 5:
        raise HTTPException(429, detail="Too many invalid attempts. Request a new code.")

    pin_expires = user.get("pin_expires")
    if pin_expires:
        if pin_expires.tzinfo is None:
            pin_expires = pin_expires.replace(tzinfo=timezone.utc)
    if pin_expires and datetime.now(timezone.utc) > pin_expires:
        raise HTTPException(400, detail="Verification code expired. Request a new one.")

    if user.get("verification_pin") != body.pin.strip():
        await db.users.update_one({"email": email}, {"$inc": {"pin_attempts": 1}})
        raise HTTPException(400, detail="Invalid verification code")

    await db.users.update_one(
        {"email": email},
        {"$set": {"is_verified": True}, "$unset": {"verification_pin": "", "pin_expires": "", "pin_attempts": ""}}
    )
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-pin")
async def resend_pin(body: ResendRequest):
    db = get_db()
    email = body.email.lower()

    _check_rate_limit(f"resend:{email}", max_attempts=3, window_sec=600)

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, detail="Account not found")
    if user.get("is_verified"):
        return {"message": "Account already verified"}

    pin = generate_pin()
    expires = datetime.now(timezone.utc) + timedelta(minutes=PIN_EXPIRY_MINUTES)
    await db.users.update_one(
        {"email": email},
        {"$set": {"verification_pin": pin, "pin_expires": expires, "pin_attempts": 0}}
    )
    asyncio.create_task(_send_verification(email, pin))
    return {"message": "New verification code sent"}


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    db = get_db()
    email = body.email.lower()

    _check_rate_limit(f"login:{email}")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, detail="Email or password is wrong. Try again.")
    if not user.get("is_verified"):
        raise HTTPException(403, detail="Please verify your email before logging in")

    token = create_access_token(str(user["_id"]), email)

    response.set_cookie(
        key="access_token", value=token,
        httponly=True, samesite="lax", max_age=86400 * 7
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": email,
            "role": user.get("role", "user"),
            "has_profile": bool(user.get("profile", {}).get("first_name")),
        }
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.post("/forgot-password")
async def forgot_password(body: ForgotRequest):
    db = get_db()
    email = body.email.lower()

    _check_rate_limit(f"reset:{email}", max_attempts=3, window_sec=3600)

    user = await db.users.find_one({"email": email})
    if user:
        token = generate_token()
        expires = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRY_HRS)
        await db.users.update_one(
            {"email": email},
            {"$set": {"reset_token": token, "reset_expires": expires}}
        )
        asyncio.create_task(_send_reset(email, token))

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetRequest):
    db = get_db()

    if len(body.new_password) < 8:
        raise HTTPException(400, detail="Password must be at least 8 characters")

    user = await db.users.find_one({"reset_token": body.token})
    if not user:
        raise HTTPException(400, detail="Invalid or expired reset link")

    expires = user.get("reset_expires")
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    if expires and datetime.now(timezone.utc) > expires:
        raise HTTPException(400, detail="Reset link has expired")

    await db.users.update_one(
        {"reset_token": body.token},
        {
            "$set": {"password_hash": hash_password(body.new_password)},
            "$unset": {"reset_token": "", "reset_expires": ""}
        }
    )
    return {"message": "Password reset successfully. You can now log in."}
