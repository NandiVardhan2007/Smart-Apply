import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None

db = MongoDB()

async def connect_to_mongo():
    db.client = AsyncIOMotorClient(settings.MONGO_URI)
    logger.info("Connected to MongoDB")

async def close_mongo_connection():
    db.client.close()
    logger.info("Closed MongoDB connection")

def get_database():
    return db.client.get_database("smartapply")
