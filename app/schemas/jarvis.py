from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

class JarvisMessage(BaseModel):
    role: str = Field(..., description="Role of the sender: 'user' or 'jarvis'")
    content: str = Field(..., description="Content of the message")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JarvisChatRequest(BaseModel):
    message: str
    history: Optional[List[JarvisMessage]] = []
    deep_think: bool = False
    image_data: Optional[str] = None

class JarvisChatResponse(BaseModel):
    message: str
    suggestions: List[str] = []
    memory_updated: bool = False
    action_taken: Optional[str] = None
    error: bool = False
