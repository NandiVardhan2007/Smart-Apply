"""
Code Execution Router — Secure sandboxed code execution via the Judge0 CE API.

Judge0 (https://judge0.com) is a robust, open-source online code execution
system. We use the Community Edition hosted on RapidAPI, which provides
a free tier. Each submission runs in an isolated container with:
  • No network access from inside the sandbox
  • No filesystem persistence between runs
  • Hard CPU / memory / time limits enforced by the engine

This router acts as a thin, rate-limited proxy so the frontend never talks
to Judge0 directly (keeping API keys out of the client bundle and letting
us enforce our own payload limits server-side).
"""

import base64
import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.rate_limiter import limiter

logger = logging.getLogger("code-execution")

router = APIRouter(prefix="/api/code", tags=["Code Execution"])

# ── Language → Judge0 language_id mapping ──
# Full list: https://ce.judge0.com/#statuses-and-languages-languages
LANGUAGE_MAP: dict[str, dict] = {
    "javascript": {"id": 63,  "name": "JavaScript (Node.js 12.14.0)"},
    "typescript": {"id": 74,  "name": "TypeScript (3.7.4)"},
    "python":     {"id": 71,  "name": "Python (3.8.1)"},
    "java":       {"id": 62,  "name": "Java (OpenJDK 13.0.1)"},
    "cpp":        {"id": 54,  "name": "C++ (GCC 9.2.0)"},
}

MAX_CODE_LENGTH = 50_000  # 50 KB
JUDGE0_TIMEOUT = 15       # our HTTP timeout for Judge0 calls
RUN_TIME_LIMIT = 10       # seconds — hard limit Judge0 enforces on the run
MEMORY_LIMIT = 128_000    # KB — 128 MB memory limit


class ExecuteRequest(BaseModel):
    language: str = Field(..., description="One of: javascript, typescript, python, java, cpp")
    code: str = Field(..., max_length=MAX_CODE_LENGTH, description="Source code to execute")
    stdin: str = Field("", description="Optional stdin input for the program")


class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    execution_time: Optional[float] = None
    language: str
    version: str


def _get_judge0_headers() -> dict[str, str]:
    """Build request headers for the Judge0 API (RapidAPI-hosted or self-hosted)."""
    headers: dict[str, str] = {"Content-Type": "application/json"}

    judge0_key = settings.JUDGE0_API_KEY
    judge0_host = settings.JUDGE0_API_HOST

    if judge0_key:
        # RapidAPI-hosted Judge0 CE
        headers["X-RapidAPI-Key"] = judge0_key
        headers["X-RapidAPI-Host"] = judge0_host
    return headers


@router.post("/execute", response_model=ExecuteResponse)
@limiter.limit("10/minute")
async def execute_code(
    request: Request,
    body: ExecuteRequest,
    current_user: User = Depends(get_current_user),
):
    """Execute user code in a secure Judge0 sandbox and return the output."""

    lang_key = body.language.lower().strip()
    runtime = LANGUAGE_MAP.get(lang_key)
    if not runtime:
        supported = ", ".join(sorted(LANGUAGE_MAP.keys()))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language '{body.language}'. Supported: {supported}",
        )

    if not body.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    if not settings.JUDGE0_API_KEY:
        # Mock execution if no key is provided to avoid requiring a credit card for now
        return ExecuteResponse(
            stdout=f"[Mock Execution]\nCode received for {runtime['name']}.\n\nExecution is currently paused as the Judge0 API key is not configured.\nYou can add a JUDGE0_API_KEY in the backend .env file later.",
            stderr="",
            exit_code=0,
            execution_time=0.1,
            language=runtime["name"],
            version=runtime["name"],
        )

    # Judge0 accepts base64-encoded source to handle special characters
    encoded_code = base64.b64encode(body.code.encode()).decode()
    encoded_stdin = base64.b64encode(body.stdin.encode()).decode() if body.stdin else ""

    judge0_payload = {
        "language_id": runtime["id"],
        "source_code": encoded_code,
        "stdin": encoded_stdin,
        "cpu_time_limit": RUN_TIME_LIMIT,
        "wall_time_limit": RUN_TIME_LIMIT + 5,
        "memory_limit": MEMORY_LIMIT,
    }

    base_url = settings.JUDGE0_API_URL
    headers = _get_judge0_headers()
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=JUDGE0_TIMEOUT) as client:
            # Submit with ?wait=true for synchronous result (simpler flow)
            # base64_encoded=true tells Judge0 our source_code is base64
            resp = await client.post(
                f"{base_url}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,exit_code,time,compile_output,status",
                json=judge0_payload,
                headers=headers,
            )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Code execution timed out. Try reducing complexity or adding input limits.",
        )
    except httpx.HTTPError as exc:
        logger.error(f"Judge0 request failed: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Code execution service is temporarily unavailable. Please try again.",
        )

    elapsed = round(time.monotonic() - start, 3)

    if resp.status_code != 200 and resp.status_code != 201:
        logger.error(f"Judge0 returned {resp.status_code}: {resp.text[:500]}")
        raise HTTPException(
            status_code=502,
            detail="Code execution service returned an error. Please try again.",
        )

    data = resp.json()

    # Decode base64 outputs from Judge0
    raw_stdout = data.get("stdout") or ""
    raw_stderr = data.get("stderr") or ""
    compile_output = data.get("compile_output") or ""

    try:
        stdout = base64.b64decode(raw_stdout).decode("utf-8", errors="replace") if raw_stdout else ""
    except Exception:
        stdout = raw_stdout

    try:
        stderr = base64.b64decode(raw_stderr).decode("utf-8", errors="replace") if raw_stderr else ""
    except Exception:
        stderr = raw_stderr

    try:
        compile_err = base64.b64decode(compile_output).decode("utf-8", errors="replace") if compile_output else ""
    except Exception:
        compile_err = compile_output

    # Judge0 status: id=6 means compilation error
    status_info = data.get("status", {})
    status_id = status_info.get("id", 0) if isinstance(status_info, dict) else 0

    if status_id == 6 and compile_err:
        # Compilation error
        return ExecuteResponse(
            stdout="",
            stderr=compile_err,
            exit_code=1,
            execution_time=elapsed,
            language=runtime["name"],
            version=runtime["name"],
        )

    exit_code = data.get("exit_code")
    if exit_code is None:
        # If status is an error (e.g., TLE, Runtime Error), exit_code may be null
        exit_code = 0 if status_id == 3 else 1  # 3 = Accepted

    exec_time = data.get("time")
    if exec_time is not None:
        try:
            exec_time = float(exec_time)
        except (ValueError, TypeError):
            exec_time = elapsed

    return ExecuteResponse(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        execution_time=exec_time or elapsed,
        language=runtime["name"],
        version=runtime["name"],
    )
