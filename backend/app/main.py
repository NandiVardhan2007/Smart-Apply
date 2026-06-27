import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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

# ── CORS (for development with Vite dev server) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000", "https://www.smartapplies.app", "https://smartapplies.app"],
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

# ── Serve frontend static files (production) ──
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
FRONTEND_DIR = os.path.abspath(FRONTEND_DIR)

if os.path.isdir(FRONTEND_DIR):
    # Mount static assets (JS, CSS, images)
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the React SPA — return index.html for all non-API routes."""
        # Try to serve the exact file first (favicon, manifest, etc.)
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Fall back to index.html for SPA routing
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
