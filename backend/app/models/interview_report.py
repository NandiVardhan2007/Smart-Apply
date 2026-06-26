from datetime import datetime
from typing import List, Dict, Optional
from beanie import Document
from pydantic import Field

class InterviewReport(Document):
    user_id: str
    room_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    questions_asked: List[str] = Field(default_factory=list)
    user_replies: List[str] = Field(default_factory=list)
    areas_for_improvement: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    
    # E.g., {"avg_confidence": 0.85, "blink_count": 12, "expressions": {...}}
    telemetry_summary: Dict = Field(default_factory=dict)
    
    # 0 to 100 rating
    final_score: int = 0
    overall_feedback: str = ""
    communication_feedback: str = ""

    class Settings:
        name = "interview_reports"
