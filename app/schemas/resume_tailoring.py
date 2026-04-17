"""
Pydantic schemas for the Resume Tailoring & LaTeX Generation Engine.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class TailorResumeRequest(BaseModel):
    """Request body for the resume tailoring endpoint."""
    job_description: Optional[str] = Field(
        None,
        description="Raw job description text. Provide this OR job_url."
    )
    job_url: Optional[str] = Field(
        None,
        description="URL of the job posting to scrape. Provide this OR job_description."
    )
    style_hint: str = Field(
        "professional",
        description="Resume style hint: professional, startup, academic, entry_level"
    )


class ScrapeJobRequest(BaseModel):
    """Request body for the job URL scraping endpoint."""
    url: str = Field(..., description="The job posting URL to scrape.")


class ScrapeJobResponse(BaseModel):
    """Response from the job URL scraping endpoint."""
    title: str
    company: str
    description: str
    url: str


class JobAnalysis(BaseModel):
    """Structured analysis of a job posting."""
    job_title: str = ""
    seniority_level: str = ""
    company: str = ""
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    tools_technologies: List[str] = []
    responsibilities: List[str] = []
    keywords: List[str] = []
    soft_skills: List[str] = []
    domain: str = ""


class MatchSummary(BaseModel):
    """Summary of how well the user's profile matches the job."""
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    matched_experience: List[str] = []
    strongest_highlights: List[str] = []
    placeholders_used: List[str] = []
    tailoring_score: int = Field(0, ge=0, le=100, description="0-100 tailoring quality score")
    strategy: str = ""


class TailorResumeResponse(BaseModel):
    """Response from the resume tailoring endpoint."""
    id: str
    job_title: str
    company: str
    latex_code: str
    job_analysis: Dict
    match_summary: Dict
    style_used: str
    created_at: str
