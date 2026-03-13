from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
from pymongo import IndexModel, ASCENDING
from backend.config import MONGO_URI, DB_NAME
import asyncio

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None
_gridfs: AsyncIOMotorGridFSBucket | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[DB_NAME]
    return _db


def get_gridfs() -> AsyncIOMotorGridFSBucket:
    global _gridfs
    if _gridfs is None:
        _gridfs = AsyncIOMotorGridFSBucket(get_db(), bucket_name="resumes")
    return _gridfs


async def init_db():
    """Create required indexes on startup."""
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("verification_pin")
    await db.users.create_index("reset_token")
    await db.applications.create_index("user_id")
    await db.applications.create_index("applied_at")
    await db.bot_sessions.create_index("user_id")
    print("✅ MongoDB indexes created")


async def close_db():
    global _client
    if _client:
        _client.close()
        _client = None
