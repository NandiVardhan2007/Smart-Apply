from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class JarvisMessage(BaseModel):
    role: str = Field(..., description="Role of the sender: 'user' or 'jarvis'")
    content: str = Field(..., description="Content of the message")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class JarvisChatRequest(BaseModel):
    message: str
    history: Optional[List[JarvisMessage]] = []

class JarvisChatResponse(BaseModel):
    message: str
    suggestions: List[str] = []
    memory_updated: bool = False
    action_taken: Optional[str] = None
