from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.user import UserOut

class AdminMetrics(BaseModel):
    total_users: int
    active_users: int
    banned_users: int
    total_applications: int
    total_emails_sent: int
    failed_emails: int
    ai_operations: int

class AuditLog(BaseModel):
    id: str
    admin_id: str
    action: str
    entity_id: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(populate_by_name=True)

class BanUserRequest(BaseModel):
    reason: Optional[str] = None

class SystemConfigUpdate(BaseModel):
    maintenance_mode: Optional[bool] = None
    max_linkedin_searches_per_day: Optional[int] = None
