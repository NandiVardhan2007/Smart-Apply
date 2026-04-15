import os
import sys
import certifi
from datetime import datetime, timezone
from pymongo import MongoClient

def extract_and_seed():
    dart_file = r"d:\SMARTAPPLY\Frontend\lib\features\auto_applier\utils\automation_script.dart"
    
    with open(dart_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract the JS portion
    start_tag = "let BOT_RUNNING = true;"
    end_tag = "})();"
    
    start_idx = content.find(start_tag)
    end_idx = content.rfind(end_tag)
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find script bounds")
        return

    js_code = content[start_idx:end_idx].strip()
    
    import asyncio
    sys.path.append(r"d:\SMARTAPPLY\Backend")
    from app.services.engine_service import engine_service
    from app.core.config import settings

    async def run():
        from app.db.mongodb import db, get_database
        from app.core.config import settings
        from motor.motor_asyncio import AsyncIOMotorClient
        import certifi

        # Manually initialize the client
        db.client = AsyncIOMotorClient(
            settings.MONGO_URI,
            tlsCAFile=certifi.where()
        )
        
        await engine_service.seed_initial_script(js_code)
        
        # Also force a new version to ensure latest logic is used
        database = db.client.get_database("smartapply")
        latest = await database["automation_engines"].find_one({}, sort=[("version", -1)])
        new_v = (latest["version"] + 1) if latest else 1
        
        await database["automation_engines"].update_many({}, {"$set": {"status": "archived"}})
        await database["automation_engines"].insert_one({
            "version": new_v,
            "javascript": js_code,
            "status": "active",
            "created_at": datetime.now(timezone.utc)
        })
        print(f"Forced engine update to Version {new_v}")
        
    asyncio.run(run())
    print("Successfully seeded OTA script into MongoDB!")

if __name__ == '__main__':
    extract_and_seed()
