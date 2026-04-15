import logging
import json
from datetime import datetime, timezone
from bson import ObjectId
from app.db.mongodb import get_database
from app.services.ai_parser import get_next_client
from app.utils.json_repair import robust_json_loads

logger = logging.getLogger(__name__)

class EngineService:
    def __init__(self):
        self.collection_name = "automation_engines"

    async def get_latest_script(self) -> str:
        """Returns the raw JavaScript code for the latest active engine."""
        db = get_database()
        # Find the most recently deployed active script
        doc = await db[self.collection_name].find_one(
            {"status": "active"}, 
            sort=[("version", -1)]
        )
        if doc and "javascript" in doc:
            return doc["javascript"]
        
        return "// NO SCRIPT FOUND"

    async def seed_initial_script(self, fallback_script: str) -> None:
        """Seeds the initial script if the collection is empty."""
        db = get_database()
        count = await db[self.collection_name].count_documents({})
        if count == 0:
            await db[self.collection_name].insert_one({
                "version": 1,
                "javascript": fallback_script,
                "status": "active",
                "created_at": datetime.now(timezone.utc)
            })

    async def auto_heal_script(self, error_msg: str, html_snapshot: str, current_version_limit: int = 50) -> str:
        """
        Takes the error and DOM snapshot, queries the AI to fix the JavaScript,
        and deploys a new version to MongoDB.
        """
        db = get_database()
        
        # Prevent runaway healing (infinite loop)
        count = await db[self.collection_name].count_documents({})
        if count > current_version_limit:
             logger.error("Auto-heal limit reached. Manual intervention required.")
             return "LIMIT_REACHED"

        latest_doc = await db[self.collection_name].find_one({}, sort=[("version", -1)])
        if not latest_doc:
            return "NO_BASE_SCRIPT"
            
        current_script = latest_doc["javascript"]
        version = latest_doc.get("version", 1)

        system_prompt = """You are an elite JavaScript engineer specialized in DOM manipulation and browser automation.
You are maintaining a LinkedIn auto-applier JS script.
The script recently failed with an error. You are provided with:
1. The Error Message
2. The HTML DOM Snapshot of where it failed
3. The Current JavaScript Code

Your task is to analyze the DOM snapshot, find why the script failed (e.g., changed class names, new element types), and rewrite/patch the JavaScript code so it works with the new layout.

CRITICAL INSTRUCTIONS:
- You must return ONLY the complete, fully functioning JavaScript code.
- DO NOT wrap the code in Markdown blocks like ```javascript.
- Return RAW text.
- Do NOT remove any existing features. Just patch the broken selector/logic.
"""

        user_prompt = f"""
ERROR:
{error_msg}

DOM SNAPSHOT (Truncated):
{html_snapshot[:30000]}

CURRENT JAVASCRIPT:
{current_script}
"""
        
        try:
            client = get_next_client()
            response = await client.chat.completions.create(
                model="meta/llama-3.1-8b-instruct",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                max_tokens=6000,
            )
            
            healed_script = response.choices[0].message.content
            # Cleanup markdown if AI ignores instructions
            if healed_script.startswith("```"):
                # Handle possible ```javascript\n or just ```\n
                lines = healed_script.split("\n")
                if lines[0].startswith("```"):
                    healed_script = "\n".join(lines[1:])
            if healed_script.endswith("```"):
                healed_script = healed_script.rsplit("```", 1)[0]
            
            healed_script = healed_script.strip()
                
            # Deactivate old scripts
            await db[self.collection_name].update_many({}, {"$set": {"status": "archived"}})
            
            # Save new script
            new_version = version + 1
            await db[self.collection_name].insert_one({
                "version": new_version,
                "javascript": healed_script,
                "status": "active",
                "healing_cause": error_msg,
                "created_at": datetime.now(timezone.utc)
            })
            
            logger.info(f"[Sandbox] Auto-healed script to version {new_version}")
            return healed_script
            
        except Exception as e:
            logger.error(f"[Sandbox] Auto-heal failed: {e}")
            raise e

engine_service = EngineService()
