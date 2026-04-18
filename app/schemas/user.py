from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[str] = None
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    current_city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    
    # Advanced Job Profile Fields
    primary_field: Optional[str] = "Engineering" # Engineering, Management, Others
    is_engineering_completed: Optional[bool] = None
    graduation_year: Optional[int] = None
    notice_period_days: Optional[int] = None
    current_ctc: Optional[float] = None
    expected_ctc: Optional[float] = None
    gender: Optional[str] = None
    is_authorized_to_work: Optional[bool] = True
    requires_sponsorship: Optional[bool] = False
    willing_to_relocate: Optional[bool] = True
    highest_degree: Optional[str] = "Bachelor's"
    work_experience_years: Optional[float] = None
    
    # Automation Search Config
    search_terms: Optional[str] = None # Comma separated
    bad_words: Optional[str] = None # Comma separated

class ResumeItem(BaseModel):
    id: str
    name: str
    url: str
    is_default: bool = False
    created_at: str

class UserOut(UserBase):
    id: str
    role: str = "user"
    is_banned: bool = False
    phone: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[str] = None
    is_profile_completed: bool = False
    profile_pic_url: Optional[str] = None
    resume_url: Optional[str] = None
    resumes: List[ResumeItem] = []
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    current_city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    
    # Advanced Job Profile Fields
    primary_field: Optional[str] = "Engineering"
    is_engineering_completed: Optional[bool] = None
    graduation_year: Optional[int] = None
    notice_period_days: Optional[int] = None
    current_ctc: Optional[float] = None
    expected_ctc: Optional[float] = None
    gender: Optional[str] = None
    is_authorized_to_work: Optional[bool] = True
    requires_sponsorship: Optional[bool] = False
    willing_to_relocate: Optional[bool] = True
    highest_degree: Optional[str] = None
    work_experience_years: Optional[float] = None
    
    # Automation Search Config
    search_terms: Optional[str] = None
    bad_words: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    is_profile_completed: bool = False

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
