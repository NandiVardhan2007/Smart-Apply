from datetime import datetime
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class Resume(Document):
    """Resume document stored in MongoDB."""

    user_id: PydanticObjectId
    filename: str
    file_url: str
    file_key: str = ""
    extracted_text: str = ""
    latex_code: str = ""
    html_code: str = ""

    is_primary: bool = False
    ats_score: Optional[int] = None

    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "resumes"
