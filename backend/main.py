import logging
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
import asyncio
import time
import httpx

from backend.database import init_db, close_db
from backend.routers import auth, resume, profile, jobs, ai, admin
from backend.config import APP_URL

logger = logging.getLogger(__name__)

PING_INTERVAL = 10 * 60


async def _self_ping_loop():
    url = APP_URL.rstrip("/") + "/health"
    await asyncio.sleep(90)
    logger.info(f"[self-ping] Started — pinging {url} every {PING_INTERVAL // 60} min")
    async with httpx.AsyncClient(timeout=15) as client:
        while True:
            try:
                r = await client.get(url)
                logger.info(f"[self-ping] {r.status_code} OK")
            except Exception as e:
                logger.warning(f"[self-ping] failed: {e}")
            await asyncio.sleep(PING_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    ping_task = asyncio.create_task(_self_ping_loop())
    yield
    ping_task.cancel()
    await close_db()


app = FastAPI(
    title="SmartApply API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── Global error handler ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse({"detail": "Internal server error"}, status_code=500)

# ── Middleware ─────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info(f"[{request.method}] {request.url.path} → {response.status_code} ({duration}ms)")
    return response

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api")
app.include_router(resume.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SmartApply API"}

# ── Frontend ───────────────────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/{page:path}")
    async def serve_frontend(page: str):
        if page.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        target = FRONTEND_DIR / page
        if target.exists() and target.is_file():
            return FileResponse(str(target))
        index = FRONTEND_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"detail": "Not found"}, status_code=404)
