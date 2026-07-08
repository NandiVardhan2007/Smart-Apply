from datetime import datetime
from typing import List, Optional

from beanie import Document, Indexed
from pydantic import EmailStr, Field


class User(Document):
    """User document stored in MongoDB."""

    email: Indexed(EmailStr, unique=True)  # type: ignore[valid-type]
    hashed_password: str = ""
    full_name: str = ""
    is_verified: bool = False
    is_admin: bool = False

    # OTP fields
    otp_code: Optional[str] = None
    otp_expires_at: Optional[datetime] = None

    # Profile fields
    profile_pic_url: Optional[str] = None
    resume_url: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    education: List[str] = Field(default_factory=list)
    experience: List[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
