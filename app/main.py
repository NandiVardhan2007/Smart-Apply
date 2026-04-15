import asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, user, ats
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection

app = FastAPI(title="Smart Apply API", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SELF_URL = "https://smart-apply-tn6h.onrender.com/health"
PING_INTERVAL_SECONDS = 10 * 60  # 10 minutes

async def self_ping():
    """Pings the health endpoint every 10 minutes to prevent Render free tier spin-down."""
    await asyncio.sleep(30)  # Wait 30s after startup before first ping
    async with httpx.AsyncClient() as client:
        while True:
            try:
                response = await client.get(SELF_URL, timeout=10)
                print(f"[Self-Ping] ✅ Health check OK — status {response.status_code}")
            except Exception as e:
                print(f"[Self-Ping] ⚠️ Ping failed: {e}")
            await asyncio.sleep(PING_INTERVAL_SECONDS)

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()
    asyncio.create_task(self_ping())

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(ats.router, prefix="/api/ats", tags=["ATS Analysis"])

@app.get("/")
async def root():
    return {"message": "Smart Apply API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}
