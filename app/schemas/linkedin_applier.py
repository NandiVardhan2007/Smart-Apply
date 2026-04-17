"""
Schemas for the LinkedIn Auto Job Applier feature.
Covers AI-generated search terms, application Q&A, and job tracking.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime


# ── Search Term Generation ──────────────────────────────────────────

class SearchTermRequest(BaseModel):
    """Request to generate AI-powered LinkedIn search terms from user profile."""
    resume_text: Optional[str] = Field(None, description="Raw text from the user's resume")
    skills: Optional[str] = Field(None, description="Comma-separated skills")
    experience: Optional[str] = Field(None, description="Work experience summary")
    education: Optional[str] = Field(None, description="Education background")
    location: Optional[str] = Field(None, description="Preferred job location")
    job_preferences: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Additional preferences like remote/onsite, salary range, industry"
    )


class SearchTermResult(BaseModel):
    """AI-generated search terms and filters for LinkedIn job search."""
    search_queries: List[str] = Field(..., description="Ranked list of LinkedIn search queries")
    keywords: List[str] = Field(..., description="Important keywords to look for")
    job_titles: List[str] = Field(..., description="Matching job titles")
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Suggested filters (experience_level, job_type, remote, etc.)"
    )
    linkedin_search_urls: List[str] = Field(
        default_factory=list,
        description="Pre-built LinkedIn search URLs"
    )


# ── Application Question Answering ──────────────────────────────────

class AnswerQuestionRequest(BaseModel):
    """Request AI to answer a LinkedIn application question."""
    question: str = Field(..., description="The question text from the application form")
    question_type: Optional[str] = Field(
        "text",
        description="Type: text, select, radio, checkbox, number, date"
    )
    options: Optional[List[str]] = Field(
        None, description="Available options for select/radio/checkbox questions"
    )
    job_title: Optional[str] = Field(None, description="Title of the job being applied to")
    company_name: Optional[str] = Field(None, description="Company name")
    job_description: Optional[str] = Field(None, description="Snippet of the job description")
    use_smart_selection: bool = Field(False, description="Enable AI-powered resume selection")


class AnswerQuestionResponse(BaseModel):
    """AI-generated answer for an application question."""
    answer: Optional[str] = Field(None, description="The generated answer")
    confidence: float = Field(
        0.0,
        description="Confidence score 0.0-1.0. Below 0.6 means user should review."
    )
    source: str = Field(
        "ai",
        description="Where the answer came from: 'memory', 'resume', 'ai', 'unknown'"
    )
    needs_user_input: bool = Field(
        False,
        description="True if the system couldn't generate a confident answer"
    )
    explanation: Optional[str] = Field(
        None, description="Why this answer was chosen or why user input is needed"
    )


class SaveAnswerRequest(BaseModel):
    """Save a user-provided or confirmed answer to memory."""
    question: str = Field(..., description="The original question")
    answer: str = Field(..., description="The answer to save")
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    question_type: Optional[str] = "text"


# ── Application Tracking ────────────────────────────────────────────

class ApplicationLogCreate(BaseModel):
    """Log a job application attempt on LinkedIn."""
    job_title: str
    company_name: str
    job_url: str
    status: str = Field("applied", description="applied, skipped, failed, paused")
    notes: Optional[str] = None
    questions_answered: int = 0
    questions_manual: int = 0


class ApplicationLogOut(ApplicationLogCreate):
    """Persisted application log with ID and timestamps."""
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Session State ────────────────────────────────────────────────────

class ApplierSessionState(BaseModel):
    """Tracks the state of an active auto-apply session."""
    is_active: bool = False
    jobs_found: int = 0
    jobs_applied: int = 0
    jobs_skipped: int = 0
    jobs_failed: int = 0
    current_job_title: Optional[str] = None
    current_company: Optional[str] = None
    pending_question: Optional[Dict[str, Any]] = None
    search_query_used: Optional[str] = None
