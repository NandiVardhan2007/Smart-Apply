import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        # 1. login to get token
        resp = await client.post("/api/auth/login", data={"username": "kovvurinandivardhanreddy2007@gmail.com", "password": "password"}) # i dont know the password, let me use the token from db or just mock user?
        pass

asyncio.run(main())
