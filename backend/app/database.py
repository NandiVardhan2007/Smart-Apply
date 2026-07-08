from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config import settings
from app.models.user import User
from app.models.resume import Resume
from app.models.interview_report import InterviewReport
from app.models.settings import SystemSettings
from app.models.api_metrics import APILog

_client: AsyncIOMotorClient | None = None


async def init_db() -> None:
    """Initialize Motor client and Beanie ODM."""
    global _client
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    database = _client[settings.MONGODB_DB_NAME]
    await init_beanie(database=database, document_models=[User, Resume, InterviewReport, SystemSettings, APILog])


async def close_db() -> None:
    """Close the Motor client connection."""
    global _client
    if _client:
        _client.close()
        _client = None
