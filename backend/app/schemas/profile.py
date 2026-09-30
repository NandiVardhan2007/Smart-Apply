from typing import Optional
from pydantic import BaseModel

# Fields are optional with safe defaults: these entries are frequently populated from
# LLM resume parsing, and a single missing field should degrade one entry gracefully
# rather than reject the entire parse.
class EducationEntry(BaseModel):
    institution: str = ""
    degree: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None

class ExperienceEntry(BaseModel):
    company: str = ""
    role: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
