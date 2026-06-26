import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import close_db, init_db
from app.routers import ai, auth, upload, user, resume, projects, interview, tailor
from app.websockets.auth_ws import router as ws_router


import subprocess
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")

worker_process = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    global worker_process
    
    # Start the LiveKit worker automatically
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    worker_script = os.path.join(backend_dir, "agents", "interview_worker.py")
    worker_process = subprocess.Popen([sys.executable, worker_script, "dev"], cwd=backend_dir)

    await init_db()
    yield
    await close_db()
    
    if worker_process:
        worker_process.terminate()
        try:
            worker_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            worker_process.kill()


app = FastAPI(
    title="Smart Apply API",
    description="AI-powered job application platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS (for development with Vite dev server) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ──
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(ai.router)
app.include_router(upload.router)
app.include_router(resume.router)
app.include_router(projects.router)
app.include_router(interview.router)
app.include_router(tailor.router)

# ── WebSocket Router ──
app.include_router(ws_router)

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
