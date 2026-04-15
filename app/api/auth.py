from fastapi import APIRouter, HTTPException, Depends, status
from app.schemas.user import UserCreate, UserLogin, Token, OTPVerify
from app.db.mongodb import get_database
from app.core.security import get_password_hash, verify_password, create_access_token
from app.services.email import email_service
import random
import string
from datetime import datetime, timedelta

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
    
    # Save OTP to db
    await db.otps.update_one(
        {"email": user_in.email},
        {"$set": {"otp": otp, "expires_at": datetime.utcnow() + timedelta(minutes=10)}},
        upsert=True
    )
    
    # Send Email
    email_sent = email_service.send_otp_email(user_in.email, otp)
    
    return {
        "message": "User registered. Please verify your email with the OTP sent.",
        "email": user_in.email,
        "email_sent": email_sent
    }

@router.post("/verify-otp", response_model=Token)
async def verify_otp(data: OTPVerify):
    db = get_database()
    
    # Find OTP
    otp_record = await db.otps.find_one({"email": data.email})
    if not otp_record or otp_record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    if otp_record["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    # Update user to is_verified=True
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"email": data.email}, {"$set": {"is_verified": True}})
    
    # Delete used OTP
    await db.otps.delete_one({"email": data.email})
    
    # Generate token
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    db = get_database()
    user = await db.users.find_one({"email": credentials.email})
    
    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Generate token
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/request-otp")
async def request_otp(email: str):
    # Simulated OTP for Demo
    otp = ''.join(random.choices(string.digits, k=6))
    if email_service.send_otp_email(email, otp):
        return {"message": "OTP sent successfully"}
    raise HTTPException(status_code=500, detail="Error sending email")
