from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime

class MemoryBase(BaseModel):
    category: str = Field(..., description="Category of the memory (e.g., career_goals, preferences, skills)")
    key: str = Field(..., description="A unique key for identifying this specific memory within a category")
    content: Any = Field(..., description="The actual data stored in the memory. Can be a string, list, or dictionary.")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional context for the memory")

class MemoryCreate(MemoryBase):
    pass

class MemoryUpdate(BaseModel):
    content: Optional[Any] = None
    metadata: Optional[Dict[str, Any]] = None

class MemoryOut(MemoryBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
