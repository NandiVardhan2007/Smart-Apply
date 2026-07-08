import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import argparse
from app.config import settings
from app.models.user import User

async def promote_admin(email: str):
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await init_beanie(database=client[settings.MONGODB_DB_NAME], document_models=[User])

    user = await User.find_one(User.email == email)
    if not user:
        print(f"Error: User with email {email} not found.")
        return

    user.is_admin = True
    await user.save()
    print(f"Successfully promoted {email} to admin!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Promote a user to admin.")
    parser.add_argument("email", type=str, help="The email of the user to promote.")
    args = parser.parse_args()
    
    # Run the async function
    asyncio.run(promote_admin(args.email))
