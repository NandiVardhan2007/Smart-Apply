from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field

class SystemSettings(Document):
    """Global system settings stored in MongoDB."""

    maintenance_mode: bool = False
    allow_new_signups: bool = True
    nvidia_nim_api_key: Optional[str] = None
    
    announcement_active: bool = False
    announcement_message: str = ""
    announcement_type: str = "info"
    
    prompts: dict[str, str] = Field(default_factory=dict)
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "system_settings"
