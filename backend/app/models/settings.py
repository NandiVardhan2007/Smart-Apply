from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field

class SystemSettings(Document):
    """Global system settings stored in MongoDB."""

    maintenance_mode: bool = False
    allow_new_signups: bool = True
    openai_api_key: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "system_settings"
