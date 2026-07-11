from datetime import datetime
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field, BaseModel

from app.schemas.profile import EducationEntry, ExperienceEntry


class ResumeParsedData(BaseModel):
    skills: list[str] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)

class Resume(Document):
    """Resume document stored in MongoDB."""

    user_id: PydanticObjectId
    filename: str
    file_url: str
    file_key: str = ""
    extracted_text: str = ""
    parsed_data: Optional[ResumeParsedData] = None
    latex_code: str = ""
    html_code: str = ""

    is_primary: bool = False
    ats_score: Optional[int] = None

    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "resumes"
        indexes = [
            [("user_id", 1), ("is_primary", -1)],
            "uploaded_at",
            [("extracted_text", "text")]
        ]
