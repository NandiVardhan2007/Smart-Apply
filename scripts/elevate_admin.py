import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def elevate_user():
    # Load .env from current directory or parent
    load_dotenv()
    
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("MONGO_URI not found in environment")
        return

    client = AsyncIOMotorClient(mongo_uri)
    db = client.get_database("smartapply") # Fixed from SmartApply to match case
    
    target_email = "kovvurinandivardhanreddy2007@gmail.com"
    
    print(f"Attempting to elevate user: {target_email}...")
    
    # Try to find user
    user = await db.users.find_one({"email": target_email})
    
    if not user:
        print(f"User {target_email} not found. Creating a placeholder user...")
        # If user doesn't exist, we can create one or just warn.
        # usually better to wait for them to register, but I'll update if exists.
        result = await db.users.insert_one({
            "email": target_email,
            "role": "admin",
            "is_verified": True,
            "is_banned": False,
            "full_name": "Admin User",
            "created_at": "SYSTEM_MANUAL"
        })
        print(f"Created new admin user with ID: {result.inserted_id}")
    else:
        result = await db.users.update_one(
            {"email": target_email},
            {"$set": {"role": "admin", "is_verified": True}}
        )
        if result.modified_count > 0:
            print("Successfully elevated user to admin.")
        else:
            print("User was already an admin or update failed.")

    client.close()

if __name__ == "__main__":
    asyncio.run(elevate_user())
