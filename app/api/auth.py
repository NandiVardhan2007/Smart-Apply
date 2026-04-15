from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from app.schemas.user import UserCreate, UserLogin, Token, OTPVerify, ForgotPasswordRequest, PasswordReset
from app.db.mongodb import get_database
from app.core.security import get_password_hash, verify_password, create_access_token
from app.services.email import email_service
import random
import string
from datetime import datetime, timedelta, timezone

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate):
    db = get_database()
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user and existing_user.get("is_verified", False):
        raise HTTPException(status_code=400, detail="User already registered")
    
    # Hash password
    hashed_password = get_password_hash(user_in.password)
    
    # Save/Update user (with is_verified=False)
    user_dict = user_in.dict()
    user_dict["hashed_password"] = hashed_password
    user_dict["is_verified"] = False
    del user_dict["password"]
    
    if existing_user:
        await db.users.replace_one({"_id": existing_user["_id"]}, user_dict)
        user_id = str(existing_user["_id"])
    else:
        result = await db.users.insert_one(user_dict)
        user_id = str(result.inserted_id)
    
    # Generate OTP
    otp = ''.join(random.choices(string.digits, k=6))
    hashed_otp = get_password_hash(otp)
    
    # Save OTP to db
    await db.otps.update_one(
        {"email": user_in.email},
        {
            "$set": {
                "otp": hashed_otp, 
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
                "attempts": 0
            }
        },
        upsert=True
    )
    
    # Send Email (OTP)
    email_sent = await email_service.send_otp_email(user_in.email, otp)
    
    return {
        "message": "User registered. Please verify your email with the OTP sent.",
        "email": user_in.email,
        "email_sent": email_sent
    }

@router.post("/verify-otp", response_model=Token)
async def verify_otp(data: OTPVerify, background_tasks: BackgroundTasks):
    db = get_database()
    
    # Find OTP
    otp_record = await db.otps.find_one({"email": data.email})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP requested for this email")
    
    if otp_record["expires_at"] < datetime.now(timezone.utc):
        await db.otps.delete_one({"email": data.email})
        raise HTTPException(status_code=400, detail="OTP has expired")

    if otp_record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP.")

    if not verify_password(data.otp, otp_record["otp"]):
        await db.otps.update_one({"email": data.email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Update user to is_verified=True
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Send Welcome Email only if this is the first time they are being verified
    if not user.get("is_verified", False):
        background_tasks.add_task(email_service.send_welcome_email, user["email"], user.get("full_name"))
    
    await db.users.update_one({"email": data.email}, {"$set": {"is_verified": True}})
    
    # Delete used OTP
    await db.otps.delete_one({"email": data.email})
    
    # Generate token
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "is_profile_completed": user.get("is_profile_completed", False)
    }

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    db = get_database()
    user = await db.users.find_one({"email": credentials.email})
    
    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Generate token
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "is_profile_completed": user.get("is_profile_completed", False)
    }

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    db = get_database()
    user = await db.users.find_one({"email": request.email})
    
    if not user:
        # Don't reveal user existence for security
        return {"message": "If an account with this email exists, an OTP has been sent."}
    
    # Generate OTP
    otp = ''.join(random.choices(string.digits, k=6))
    hashed_otp = get_password_hash(otp)
    
    # Save OTP to db
    await db.otps.update_one(
        {"email": request.email},
        {
            "$set": {
                "otp": hashed_otp, 
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
                "attempts": 0,
                "purpose": "password_reset"
            }
        },
        upsert=True
    )
    
    # Send Email
    await email_service.send_otp_email(request.email, otp, purpose="password_reset")
    
    return {"message": "Password reset OTP sent successfully."}

@router.post("/reset-password")
async def reset_password(data: PasswordReset):
    db = get_database()
    
    # Find OTP
    otp_record = await db.otps.find_one({"email": data.email, "purpose": "password_reset"})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No password reset requested for this email")
    
    if otp_record["expires_at"] < datetime.now(timezone.utc):
        await db.otps.delete_one({"email": data.email})
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    if otp_record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP.")

    if not verify_password(data.otp, otp_record["otp"]):
        await db.otps.update_one({"email": data.email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Update password
    hashed_password = get_password_hash(data.new_password)
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    # Delete used OTP
    await db.otps.delete_one({"email": data.email})
    
    return {"message": "Password has been reset successfully."}

@router.post("/request-otp")
async def request_otp(email: str):
    db = get_database()
    # Check if user exists
    user = await db.users.find_one({"email": email})
    if not user:
         raise HTTPException(status_code=404, detail="User not found")
         
    otp = ''.join(random.choices(string.digits, k=6))
    hashed_otp = get_password_hash(otp)
    
    await db.otps.update_one(
        {"email": email},
        {
            "$set": {
                "otp": hashed_otp, 
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
                "attempts": 0
            }
        },
        upsert=True
    )
    
    if await email_service.send_otp_email(email, otp):
        return {"message": "OTP sent successfully"}
    raise HTTPException(status_code=500, detail="Error sending email")
