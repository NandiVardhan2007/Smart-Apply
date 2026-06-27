import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.rate_limiter import limiter
from app.config import settings

from app.database import close_db, init_db
from app.routers import ai, auth, upload, user, resume, projects, interview, tailor, stats
from app.websockets.auth_ws import router as ws_router


import subprocess
import sys
import logging
import asyncio
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")

worker_process = None

async def self_ping():
    while True:
        try:
            await asyncio.sleep(600)  # 10 minutes
            external_url = os.getenv("EXTERNAL_URL")
            if external_url:
                ping_url = f"{external_url.rstrip('/')}/ping"
                async with httpx.AsyncClient() as client:
                    await client.get(ping_url)
                    logging.info(f"Self-pinged {ping_url}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logging.error(f"Error in self-ping: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    if settings.ENVIRONMENT == "production":
        assert settings.SECRET_KEY != "change-this-in-production", "SECRET_KEY must be changed in production"

    ping_task = asyncio.create_task(self_ping())

    await init_db()
    yield
    await close_db()

    ping_task.cancel()


app = FastAPI(
    title="Smart Apply API",
    description="AI-powered job application platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──
origins = ["https://www.smartapplies.app", "https://smartapplies.app"]
if settings.ENVIRONMENT != "production":
    origins.extend(["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
async def ping():
    return {"status": "ok"}

# ── API Routers ──
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(ai.router)
app.include_router(upload.router)
app.include_router(resume.router)
app.include_router(projects.router)
app.include_router(interview.router)
app.include_router(tailor.router)
app.include_router(stats.router)

# ── WebSocket Router ──
app.include_router(ws_router, prefix="/api")

# SPA Serving removed - handled by Render separate frontend service
