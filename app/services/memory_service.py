from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from app.db.mongodb import get_database
from app.schemas.memory import MemoryCreate, MemoryUpdate
import logging

logger = logging.getLogger(__name__)

class MemoryService:
    def __init__(self):
        self.collection_name = "user_memories"

    async def create_memory(self, user_id: str, memory_in: MemoryCreate) -> Dict[str, Any]:
        db = get_database()
        memory_dict = memory_in.dict()
        memory_dict["user_id"] = user_id
        memory_dict["created_at"] = datetime.utcnow()
        memory_dict["updated_at"] = datetime.utcnow()
        
        # Ensure we don't have duplicate category/key for the same user
        existing = await db[self.collection_name].find_one({
            "user_id": user_id,
            "category": memory_in.category,
            "key": memory_in.key
        })
        
        if existing:
            # Update existing instead of creating if category/key matches
            update_data = {
                "content": memory_in.content,
                "metadata": {**existing.get("metadata", {}), **memory_in.metadata},
                "updated_at": datetime.utcnow()
            }
            await db[self.collection_name].update_one(
                {"_id": existing["_id"]},
                {"$set": update_data}
            )
            existing.update(update_data)
            existing["id"] = str(existing["_id"])
            return existing

        result = await db[self.collection_name].insert_one(memory_dict)
        memory_dict["id"] = str(result.inserted_id)
        return memory_dict

    async def get_memories(self, user_id: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_database()
        query = {"user_id": user_id}
        if category:
            query["category"] = category
            
        cursor = db[self.collection_name].find(query).sort("updated_at", -1)
        memories = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            memories.append(doc)
        return memories

    async def get_memory_by_id(self, user_id: str, memory_id: str) -> Optional[Dict[str, Any]]:
        db = get_database()
        doc = await db[self.collection_name].find_one({
            "_id": ObjectId(memory_id),
            "user_id": user_id
        })
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def update_memory(self, user_id: str, memory_id: str, memory_update: MemoryUpdate) -> Optional[Dict[str, Any]]:
        db = get_database()
        update_data = {k: v for k, v in memory_update.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        
        if not update_data:
            return await self.get_memory_by_id(user_id, memory_id)

        result = await db[self.collection_name].update_one(
            {"_id": ObjectId(memory_id), "user_id": user_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            return await self.get_memory_by_id(user_id, memory_id)
        return None

    async def delete_memory(self, user_id: str, memory_id: str) -> bool:
        db = get_database()
        result = await db[self.collection_name].delete_one({
            "_id": ObjectId(memory_id),
            "user_id": user_id
        })
        return result.deleted_count > 0

    async def search_memories(self, user_id: str, query_str: str) -> List[Dict[str, Any]]:
        db = get_database()
        # Simple text search or regex on category or content if content is string
        # For structured content, we might search levels.
        # Here we do a basic regex search on 'key' and 'category' and stringify content for search
        query = {
            "user_id": user_id,
            "$or": [
                {"category": {"$regex": query_str, "$options": "i"}},
                {"key": {"$regex": query_str, "$options": "i"}},
                {"content": {"$regex": query_str, "$options": "i"}}
            ]
        }
        cursor = db[self.collection_name].find(query)
        memories = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            memories.append(doc)
        return memories

memory_service = MemoryService()
