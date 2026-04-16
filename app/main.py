import asyncio
import httpx
import logging
from datetime import datetime
from app.utils.monitoring import log_resource_usage
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, user, ats, linkedin, memory, linkedin_applier, jarvis
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def self_ping():
    """Pings the health endpoint at intervals to prevent Render free tier spin-down."""
    await asyncio.sleep(60)  # Wait 1 minute after startup before first ping
    
    # Ensure URL ends with health
    base_url = settings.RENDER_EXTERNAL_URL.rstrip('/')
    health_url = f"{base_url}/health"
    
    logger.info(f"[Self-Ping] Starting pinger targeting {health_url}")
    
    async with httpx.AsyncClient() as client:
        while True:
            try:
                # External ping to the public URL to count as ingress traffic
                response = await client.get(health_url, timeout=15)
                logger.info(f"[Self-Ping] ✅ Ingress ping OK — status {response.status_code}")
                # Log resources at every ping
                log_resource_usage("Heartbeat")
            except Exception as e:
                logger.warning(f"[Self-Ping] ⚠️ Ingress ping failed: {e}")
            
            await asyncio.sleep(settings.PING_INTERVAL)

# Track background tasks
background_tasks = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_time = asyncio.get_event_loop().time()
    logger.info(f"🚀 Starting up Smart Apply API at {datetime.now()}...")
    await connect_to_mongo()
    
    ping_task = asyncio.create_task(self_ping())
    background_tasks.add(ping_task)
    ping_task.add_done_callback(background_tasks.discard)
    
    yield
    
    # Shutdown
    uptime = asyncio.get_event_loop().time() - start_time
    logger.info(f"🛑 Graceful shutdown initiated after {uptime:.2f}s uptime.")
    logger.info("Cleaning up background tasks and database connections...")
    for task in background_tasks:
        task.cancel()
    await close_mongo_connection()
    logger.info("👋 Application shutdown complete.")

app = FastAPI(title="Smart Apply API", version="1.0.0", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(ats.router, prefix="/api/ats", tags=["ATS Analysis"])
app.include_router(linkedin.router, prefix="/api/linkedin", tags=["LinkedIn Optimizer"])
app.include_router(memory.router, prefix="/api/memory", tags=["User Memory"])
app.include_router(linkedin_applier.router, prefix="/api/linkedin-applier", tags=["LinkedIn Auto Applier"])
app.include_router(jarvis.router, prefix="/api/jarvis", tags=["JARVIS AI"])

@app.get("/")
async def root():
    return {"message": "Smart Apply API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}
