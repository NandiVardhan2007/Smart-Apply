from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING

class APILog(Document):
    """Logs of calls made to external APIs like NVIDIA NIM."""
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    endpoint: str
    response_time_ms: int
    success: bool
    status_code: int = 200
    error_message: Optional[str] = None
    
    class Settings:
        name = "api_logs"
        indexes = [
            IndexModel([("timestamp", ASCENDING)], expireAfterSeconds=60 * 60 * 24 * 30)
        ]
