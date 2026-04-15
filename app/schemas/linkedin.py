"""
LinkedIn Optimizer Schemas
Request and response models for the LinkedIn profile optimization endpoint.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class ExperienceEntry(BaseModel):
    """A single experience/job entry from the LinkedIn profile."""
    title: str = ""
    company: str = ""
    date_range: str = ""
    description: str = ""
    location: str = ""


class EducationEntry(BaseModel):
    """A single education entry from the LinkedIn profile."""
    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    date_range: str = ""
    description: str = ""


class LinkedInProfileData(BaseModel):
    """Structured LinkedIn profile data extracted from the WebView."""
    full_name: str = ""
    headline: str = ""
    about: str = ""
    location: str = ""
    current_role: str = ""
    experience: List[ExperienceEntry] = Field(default_factory=list)
    education: List[EducationEntry] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    has_profile_photo: bool = False
    has_banner_photo: bool = False
    profile_url: str = ""
    connections_count: str = ""
    raw_extras: dict = Field(default_factory=dict)


class LinkedInOptimizeRequest(BaseModel):
    """Request body for the LinkedIn optimization endpoint."""
    profile_data: LinkedInProfileData


class OptimizationCategory(BaseModel):
    """A single scored category in the optimization result."""
    name: str
    score: int = Field(ge=0, le=100)
    grade: str = ""
    icon: str = ""
    findings: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class ImprovementAction(BaseModel):
    """A single prioritized improvement action."""
    priority: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    action: str = ""
    impact: str = ""
    details: str = ""


class LinkedInOptimizationResult(BaseModel):
    """Full optimization result returned from the AI analysis."""
    overall_score: int = Field(ge=0, le=100, default=0)
    overall_grade: str = "N/A"
    summary: str = ""
    categories: List[OptimizationCategory] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    improvement_plan: List[ImprovementAction] = Field(default_factory=list)
