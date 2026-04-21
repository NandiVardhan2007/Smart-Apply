import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from app.db.mongodb import get_database
from app.schemas.memory import MemoryCreate, MemoryUpdate

logger = logging.getLogger(__name__)

class MemoryService:
    def __init__(self):
        self.collection_name = "user_memories"

    async def create_memory(self, user_id: str, memory_in: MemoryCreate) -> Dict[str, Any]:
        db = get_database()
        timestamp = datetime.now(timezone.utc)
        
        # New memory item structure (without user_id, which is top-level)
        memory_item = memory_in.dict()
        memory_item["id"] = str(uuid.uuid4())
        memory_item["created_at"] = timestamp
        memory_item["updated_at"] = timestamp

        # Atomic upsert into the user's single document
        # 1. Try to update if (category, key) already exists in the memories array
        result = await db[self.collection_name].update_one(
            {"user_id": user_id, "memories.category": memory_in.category, "memories.key": memory_in.key},
            {
                "$set": {
                    "memories.$.content": memory_in.content,
                    "memories.$.metadata": memory_in.metadata,
                    "memories.$.updated_at": timestamp,
                    "updated_at": timestamp
                }
            }
        )

        if result.matched_count == 0:
            # 2. If it didn't exist, push to the array (or create document if missing)
            await db[self.collection_name].update_one(
                {"user_id": user_id},
                {
                    "$push": {"memories": memory_item},
                    "$setOnInsert": {"created_at": timestamp},
                    "$set": {"updated_at": timestamp}
                },
                upsert=True
            )
            return memory_item
        else:
            # Fetch the updated item to return
            doc = await db[self.collection_name].find_one(
                {"user_id": user_id},
                {"memories": {"$elemMatch": {"category": memory_in.category, "key": memory_in.key}}}
            )
            return doc["memories"][0] if doc and "memories" in doc else memory_item

    async def get_memories(self, user_id: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_database()
        doc = await db[self.collection_name].find_one({"user_id": user_id})
        if not doc or "memories" not in doc:
            return []
        
        memories = doc["memories"]
        if category:
            memories = [m for m in memories if m.get("category") == category]
        
        # Sort by updated_at descending, handling missing timestamps safely
        memories.sort(
            key=lambda x: (x.get("updated_at") or datetime.min.replace(tzinfo=timezone.utc)),
            reverse=True
        )
        return memories

    async def get_memory_by_id(self, user_id: str, memory_id: str) -> Optional[Dict[str, Any]]:
        db = get_database()
        doc = await db[self.collection_name].find_one(
            {"user_id": user_id},
            {"memories": {"$elemMatch": {"id": memory_id}}}
        )
        if doc and "memories" in doc and doc["memories"]:
            return doc["memories"][0]
        return None

    async def update_memory(self, user_id: str, memory_id: str, memory_update: MemoryUpdate) -> Optional[Dict[str, Any]]:
        db = get_database()
        timestamp = datetime.now(timezone.utc)
        
        # Build update object for the array element
        update_fields = {}
        if memory_update.content is not None:
            update_fields["memories.$.content"] = memory_update.content
        if memory_update.metadata is not None:
            update_fields["memories.$.metadata"] = memory_update.metadata
        update_fields["memories.$.updated_at"] = timestamp
        update_fields["updated_at"] = timestamp

        result = await db[self.collection_name].update_one(
            {"user_id": user_id, "memories.id": memory_id},
            {"$set": update_fields}
        )
        
        if result.modified_count > 0:
            return await self.get_memory_by_id(user_id, memory_id)
        return None

    async def delete_memory(self, user_id: str, memory_id: str) -> bool:
        db = get_database()
        result = await db[self.collection_name].update_one(
            {"user_id": user_id},
            {"$pull": {"memories": {"id": memory_id}}}
        )
        return result.modified_count > 0

    async def search_memories(self, user_id: str, query_str: str) -> List[Dict[str, Any]]:
        db = get_database()
        # Since we consolidated, we can retrieve all and filter, or use MongoDB aggregation.
        # For simplicity and given the task scope, we fetch and filter in app logic.
        doc = await db[self.collection_name].find_one({"user_id": user_id})
        if not doc or "memories" not in doc:
            return []
        
        import re
        pattern = re.compile(re.escape(query_str), re.IGNORECASE)
        
        results = []
        for m in doc["memories"]:
            if (pattern.search(m.get("category", "")) or 
                pattern.search(m.get("key", "")) or 
                pattern.search(str(m.get("content", "")))):
                results.append(m)
        return results

memory_service = MemoryService()

