import asyncio
import urllib.parse
import secrets as secrets_module

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import logging
import httpx

from backend.database import get_db
from backend.auth import hash_password, verify_password, generate_pin, generate_token, create_access_token
from backend.email_utils import send_verification_email, send_reset_email
from backend.utils.email_validator import validate_email_domain
from backend.config import (
    PIN_EXPIRY_MINUTES, RESET_TOKEN_EXPIRY_HRS, MAX_LOGIN_ATTEMPTS,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

_login_attempts: dict[str, list] = {}

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _check_rate_limit(key: str, max_attempts: int = MAX_LOGIN_ATTEMPTS, window_sec: int = 300):
    now = datetime.now(timezone.utc).timestamp()
    attempts = _login_attempts.get(key, [])
    attempts = [t for t in attempts if now - t < window_sec]
    if len(attempts) >= max_attempts:
        raise HTTPException(429, detail=f"Too many attempts. Try again in {window_sec // 60} minutes.")
    attempts.append(now)
    _login_attempts[key] = attempts


async def _try_send_email(coro, context: str) -> bool:
    try:
        await coro
        return True
    except RuntimeError as exc:
        logger.error(f"[email] {context} — {exc}")
        raise HTTPException(
            status_code=500,
            detail=(
                f"Email could not be delivered: {exc} "
                "— Please ask the admin to check MAILJET settings in Render."
            )
        )
    except Exception as exc:
        logger.error(f"[email] {context} unexpected — {exc}", exc_info=True)
        raise HTTPException(500, detail="Email delivery failed due to an unexpected error.")


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# Standard email/password auth
# ─────────────────────────────────────────────────────────────────────────────

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
        pin     = generate_pin()
        expires = datetime.now(timezone.utc) + timedelta(minutes=PIN_EXPIRY_MINUTES)
        await db.users.update_one(
            {"email": email},
            {"$set": {"verification_pin": pin, "pin_expires": expires, "pin_attempts": 0}}
        )
        await _try_send_email(send_verification_email(email, pin), f"resend-otp to {email}")
        return {"message": "Verification code resent. Check your email."}

    pin     = generate_pin()
    expires = datetime.now(timezone.utc) + timedelta(minutes=PIN_EXPIRY_MINUTES)

    user_doc = {
        "email":         email,
        "password_hash": hash_password(body.password),
        "role":          "user",
        "is_verified":   False,
        "auth_provider": "email",
        "verification_pin": pin,
        "pin_expires":   expires,
        "pin_attempts":  0,
        "created_at":    datetime.now(timezone.utc),
        "profile":       {},
        "resumes":       [],
        "platform_accounts": {},
        "job_preferences":   {},
    }

    await db.users.insert_one(user_doc)
    await _try_send_email(send_verification_email(email, pin), f"signup OTP to {email}")
    return {"message": "Account created. Check your email for the 6-digit verification code."}


@router.post("/verify")
async def verify_email(body: VerifyRequest):
    db    = get_db()
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
        {"$set": {"is_verified": True},
         "$unset": {"verification_pin": "", "pin_expires": "", "pin_attempts": ""}}
    )
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-pin")
async def resend_pin(body: ResendRequest):
    db    = get_db()
    email = body.email.lower()

    _check_rate_limit(f"resend:{email}", max_attempts=3, window_sec=600)

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, detail="Account not found")
    if user.get("is_verified"):
        return {"message": "Account already verified"}

    pin     = generate_pin()
    expires = datetime.now(timezone.utc) + timedelta(minutes=PIN_EXPIRY_MINUTES)
    await db.users.update_one(
        {"email": email},
        {"$set": {"verification_pin": pin, "pin_expires": expires, "pin_attempts": 0}}
    )
    await _try_send_email(send_verification_email(email, pin), f"resend-pin to {email}")
    return {"message": "New verification code sent. Check your email."}


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    db    = get_db()
    email = body.email.lower()

    _check_rate_limit(f"login:{email}")

    user = await db.users.find_one({"email": email})

    # Block Google-only accounts from using password login
    if user and user.get("auth_provider") == "google" and not user.get("password_hash"):
        raise HTTPException(400, detail="This account uses Google Sign-In. Please click 'Continue with Google'.")

    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, detail="Email or password is wrong. Try again.")
    if not user.get("is_verified"):
        raise HTTPException(403, detail="Please verify your email before logging in.")

    token = create_access_token(str(user["_id"]), email)

    response.set_cookie(
        key="access_token", value=token,
        httponly=True, samesite="lax", max_age=86400 * 7
    )
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":          str(user["_id"]),
            "email":       email,
            "role":        user.get("role", "user"),
            "has_profile": bool(user.get("profile", {}).get("first_name")),
        }
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.post("/forgot-password")
async def forgot_password(body: ForgotRequest):
    db    = get_db()
    email = body.email.lower()

    _check_rate_limit(f"reset:{email}", max_attempts=3, window_sec=3600)

    user = await db.users.find_one({"email": email})
    if user:
        token   = generate_token()
        expires = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRY_HRS)
        await db.users.update_one(
            {"email": email},
            {"$set": {"reset_token": token, "reset_expires": expires}}
        )
        await _try_send_email(send_reset_email(email, token), f"password reset to {email}")

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
        raise HTTPException(400, detail="Reset link has expired. Please request a new one.")

    await db.users.update_one(
        {"reset_token": body.token},
        {
            "$set":   {"password_hash": hash_password(body.new_password)},
            "$unset": {"reset_token": "", "reset_expires": ""}
        }
    )
    return {"message": "Password reset successfully. You can now log in."}


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth 2.0
# ─────────────────────────────────────────────────────────────────────────────

_GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google")
async def google_login():
    """Redirect the browser to Google's OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, detail="Google OAuth is not configured. Add GOOGLE_CLIENT_ID to environment variables.")

    state = secrets_module.token_urlsafe(24)

    params = {
        "client_id":     GOOGLE_CLIENT_ID,
        "redirect_uri":  GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope":         "openid email profile",
        "state":         state,
        "access_type":   "online",
        "prompt":        "select_account",   # always show account chooser
    }

    google_url = _GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params)
    response   = RedirectResponse(url=google_url, status_code=302)

    # Store state in a short-lived cookie to validate on callback
    response.set_cookie(
        key="oauth_state", value=state,
        max_age=300, httponly=True, samesite="lax",
    )
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code:  str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    """
    Google redirects here after the user authenticates.
    Exchange the code for tokens, fetch the user's profile,
    then create / find the account and issue a SmartApply JWT.
    """
    # ── 1. Handle user-cancelled or error ────────────────────────────────────
    if error or not code:
        logger.warning(f"[google-oauth] Error or missing code: {error}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login.html?error=google_cancelled",
            status_code=302,
        )

    # ── 2. CSRF state check ───────────────────────────────────────────────────
    stored_state = request.cookies.get("oauth_state")
    if stored_state and state and stored_state != state:
        logger.warning("[google-oauth] State mismatch — possible CSRF attempt")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login.html?error=state_mismatch",
            status_code=302,
        )

    # ── 3. Exchange authorization code for access token ───────────────────────
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "code":          code,
                    "client_id":     GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri":  GOOGLE_REDIRECT_URI,
                    "grant_type":    "authorization_code",
                },
            )
        token_resp.raise_for_status()
        token_data   = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("No access token returned by Google")
    except Exception as exc:
        logger.error(f"[google-oauth] Token exchange failed: {exc}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login.html?error=google_token_failed",
            status_code=302,
        )

    # ── 4. Fetch user profile from Google ─────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            user_resp = await client.get(
                _GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        user_resp.raise_for_status()
        guser = user_resp.json()
    except Exception as exc:
        logger.error(f"[google-oauth] Userinfo fetch failed: {exc}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login.html?error=google_profile_failed",
            status_code=302,
        )

    email     = (guser.get("email") or "").lower().strip()
    google_id = str(guser.get("id") or "")
    first_name = guser.get("given_name", "")
    last_name  = guser.get("family_name", "")
    picture    = guser.get("picture", "")

    if not email:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login.html?error=google_no_email",
            status_code=302,
        )

    # ── 5. Create or find user in MongoDB ─────────────────────────────────────
    db   = get_db()
    user = await db.users.find_one({"email": email})

    if user:
        # Existing user — link Google ID if not already linked
        updates: dict = {"is_verified": True}
        if not user.get("google_id"):
            updates["google_id"]  = google_id
            updates["google_pic"] = picture
        if updates:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user_id     = str(user["_id"])
        has_profile = bool(user.get("profile", {}).get("first_name"))

    else:
        # Brand new user — create account (pre-verified, no password)
        new_user = {
            "email":         email,
            "password_hash": "",               # no password for Google accounts
            "role":          "user",
            "is_verified":   True,
            "auth_provider": "google",
            "google_id":     google_id,
            "google_pic":    picture,
            "created_at":    datetime.now(timezone.utc),
            "profile": {
                "first_name": first_name,
                "last_name":  last_name,
            },
            "resumes":           [],
            "platform_accounts": {},
            "job_preferences":   {},
        }
        result  = await db.users.insert_one(new_user)
        user_id = str(result.inserted_id)
        has_profile = bool(first_name)  # Google always gives a name

    # ── 6. Issue SmartApply JWT ───────────────────────────────────────────────
    jwt_token   = create_access_token(user_id, email)
    target_page = "dashboard.html" if has_profile else "profile.html"

    # Pass token via URL param; frontend saves it to localStorage
    redirect_url = f"{FRONTEND_URL}/{target_page}?oauth_token={jwt_token}"

    response = RedirectResponse(url=redirect_url, status_code=302)

    # Also set the httpOnly cookie (for server-side auth checks)
    response.set_cookie(
        key="access_token", value=jwt_token,
        httponly=True, samesite="lax", max_age=86400 * 7,
    )
    # Clear the oauth_state cookie
    response.delete_cookie("oauth_state")

    logger.info(f"[google-oauth] ✅ Signed in: {email} (new={not bool(user)})")
    return response