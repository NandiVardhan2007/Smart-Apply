from datetime import datetime, timezone
from typing import Optional

import secrets
from fastapi import APIRouter, HTTPException, Request, status
from app.rate_limiter import limiter

from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    OtpVerifyRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
)
from app.services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.email_service import generate_otp, get_otp_expiry, send_otp_email
from app.middleware.auth_middleware import get_session_id
from app.websockets.manager import manager

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_dict(user: User) -> dict:
    """Serialize user to a safe dict for the token response."""
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_verified": user.is_verified,
        "profile_pic_url": user.profile_pic_url,
        "has_onboarded": bool(user.bio or user.skills or user.education or user.experience),
    }


@router.post("/signup", response_model=MessageResponse)
@limiter.limit("5/minute")
async def signup(request: Request, body: SignupRequest):
    """Register a new user and send OTP email."""
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    otp = generate_otp()
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        otp_code=otp,
        otp_expires_at=get_otp_expiry(),
    )
    await user.insert()

    # Send OTP email (non-blocking — don't fail signup if email fails)
    await send_otp_email(body.email, otp)

    # Push WebSocket event
    session_id = get_session_id(request)
    if session_id:
        manager.associate_email(session_id, body.email)
        await manager.send_event(session_id, "otp_sent", {
            "email": body.email,
            "expires_in_seconds": 600,
        })

    return MessageResponse(message="Account created. Please verify your email with the OTP sent.")


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit("5/minute")
async def verify_otp(request: Request, body: OtpVerifyRequest):
    """Verify the 6-digit OTP and activate the account."""
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session_id = get_session_id(request)

    if (
        not user.otp_code
        or not secrets.compare_digest(user.otp_code, body.otp_code)
        or user.otp_expires_at is None
        or datetime.now(timezone.utc) > user.otp_expires_at.replace(tzinfo=timezone.utc)
    ):
        if session_id:
            await manager.send_event(session_id, "otp_failed", {
                "email": body.email,
                "reason": "Invalid or expired OTP",
            })
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    await user.save()

    token = create_access_token({"sub": user.email})

    if session_id:
        await manager.send_event(session_id, "otp_verified", {
            "email": user.email,
            "token": token,
            "full_name": user.full_name,
            "has_onboarded": bool(user.bio or user.skills or user.education or user.experience)
        })

    return TokenResponse(access_token=token, user=_user_dict(user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    """Authenticate with email and password."""
    user = await User.find_one(User.email == body.email)
    session_id = get_session_id(request)

    if not user or not verify_password(body.password, user.hashed_password):
        if session_id:
            await manager.send_event(session_id, "login_failed", {
                "reason": "Invalid email or password",
            })
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_verified:
        # Resend OTP
        otp = generate_otp()
        user.otp_code = otp
        user.otp_expires_at = get_otp_expiry()
        await user.save()
        await send_otp_email(user.email, otp)

        if session_id:
            await manager.send_event(session_id, "otp_sent", {
                "email": user.email,
                "expires_in_seconds": 600,
            })

        raise HTTPException(
            status_code=403,
            detail="Email not verified. A new OTP has been sent.",
        )

    token = create_access_token({"sub": user.email})

    if session_id:
        manager.associate_email(session_id, user.email)
        await manager.send_event(session_id, "login_success", {
            "email": user.email,
            "token": token,
            "full_name": user.full_name,
        })

    return TokenResponse(access_token=token, user=_user_dict(user))


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Send a password-reset OTP to the user's email."""
    user = await User.find_one(User.email == body.email)
    if not user:
        # Don't reveal whether the email exists
        return MessageResponse(message="If this email is registered, an OTP has been sent.")

    otp = generate_otp()
    user.otp_code = otp
    user.otp_expires_at = get_otp_expiry()
    await user.save()

    await send_otp_email(body.email, otp)

    session_id = get_session_id(request)
    if session_id:
        await manager.send_event(session_id, "otp_sent", {
            "email": body.email,
            "expires_in_seconds": 600,
        })

    return MessageResponse(message="If this email is registered, an OTP has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def reset_password(request: Request, body: ResetPasswordRequest):
    """Reset password after verifying OTP."""
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if (
        not user.otp_code
        or not secrets.compare_digest(user.otp_code, body.otp_code)
        or user.otp_expires_at is None
        or datetime.now(timezone.utc) > user.otp_expires_at.replace(tzinfo=timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.hashed_password = hash_password(body.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    user.is_verified = True
    await user.save()

    session_id = get_session_id(request)
    if session_id:
        await manager.send_event(session_id, "password_reset_complete", {
            "email": body.email,
        })

    return MessageResponse(message="Password has been reset successfully.")


@router.post("/resend-otp", response_model=MessageResponse)
@limiter.limit("3/minute")
async def resend_otp(request: Request, body: ForgotPasswordRequest):
    """Resend OTP to an existing user."""
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = generate_otp()
    user.otp_code = otp
    user.otp_expires_at = get_otp_expiry()
    await user.save()

    await send_otp_email(body.email, otp)

    session_id = get_session_id(request)
    if session_id:
        await manager.send_event(session_id, "otp_sent", {
            "email": body.email,
            "expires_in_seconds": 600,
        })

    return MessageResponse(message="A new OTP has been sent to your email.")
