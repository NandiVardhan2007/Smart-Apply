import asyncio
import httpx
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, user, ats, linkedin
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

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
                logger.info(f"[Self-Ping] ✅ Health check OK — status {response.status_code}")
            except asyncio.CancelledError:
                logger.info("[Self-Ping] 🛑 Ping task cancelled.")
                break
            except Exception as e:
                logger.warning(f"[Self-Ping] ⚠️ Ping failed: {e}")
            await asyncio.sleep(PING_INTERVAL_SECONDS)

# Track background tasks
background_tasks = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up Smart Apply API...")
    await connect_to_mongo()
    
    ping_task = asyncio.create_task(self_ping())
    background_tasks.add(ping_task)
    ping_task.add_done_callback(background_tasks.discard)
    
    yield
    
    # Shutdown
    logger.info("Shutting down Smart Apply API...")
    for task in background_tasks:
        task.cancel()
    await close_mongo_connection()

app.router.lifespan_context = lifespan

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(ats.router, prefix="/api/ats", tags=["ATS Analysis"])
app.include_router(linkedin.router, prefix="/api/linkedin", tags=["LinkedIn Optimizer"])

@app.get("/")
async def root():
    return {"message": "Smart Apply API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}
