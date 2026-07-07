"""
Code Execution Router — Secure sandboxed code execution via the Piston API.

Piston (https://github.com/engineer-man/piston) is an open-source, container-
isolated code execution engine. Each run is sandboxed with:
  • No network access from inside the sandbox
  • No filesystem persistence between runs
  • Hard CPU / memory / time limits enforced by the engine

This router acts as a thin, rate-limited proxy so the frontend never talks to
Piston directly (keeping the external URL out of the client bundle and letting
us enforce our own payload limits server-side).
"""

import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.rate_limiter import limiter

logger = logging.getLogger("code-execution")

router = APIRouter(prefix="/api/code", tags=["Code Execution"])

PISTON_API_URL = "https://emkc.org/api/v2/piston/execute"

# ── Language → Piston runtime mapping ──
# Piston identifies runtimes by name + version. We pin the versions so
# updates to the public Piston instance don't silently break things.
LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "javascript": {"language": "javascript", "version": "18.15.0"},
    "typescript": {"language": "typescript", "version": "5.0.3"},
    "python":     {"language": "python",     "version": "3.10.0"},
    "java":       {"language": "java",       "version": "15.0.2"},
    "cpp":        {"language": "c++",        "version": "10.2.0"},
}

MAX_CODE_LENGTH = 50_000  # 50 KB
PISTON_TIMEOUT_SECONDS = 15  # our HTTP timeout for the Piston call
RUN_TIMEOUT_MS = 10_000       # the hard time-limit Piston enforces on the run


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


@router.post("/execute", response_model=ExecuteResponse)
@limiter.limit("10/minute")
async def execute_code(
    request: Request,
    body: ExecuteRequest,
    current_user: User = Depends(get_current_user),
):
    """Execute user code in a secure Piston sandbox and return the output."""

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

    piston_payload = {
        "language": runtime["language"],
        "version": runtime["version"],
        "files": [{"content": body.code}],
        "stdin": body.stdin,
        "run_timeout": RUN_TIMEOUT_MS,
        "compile_timeout": RUN_TIMEOUT_MS,
    }

    start = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=PISTON_TIMEOUT_SECONDS) as client:
            resp = await client.post(PISTON_API_URL, json=piston_payload)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Code execution timed out. Try reducing complexity or adding input limits.",
        )
    except httpx.HTTPError as exc:
        logger.error(f"Piston request failed: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Code execution service is temporarily unavailable. Please try again.",
        )

    elapsed = round(time.monotonic() - start, 3)

    if resp.status_code != 200:
        logger.error(f"Piston returned {resp.status_code}: {resp.text[:500]}")
        raise HTTPException(
            status_code=502,
            detail="Code execution service returned an error. Please try again.",
        )

    data = resp.json()

    # Piston returns { "run": { "stdout", "stderr", "code", "output" }, ... }
    # and optionally { "compile": { ... } } for compiled languages.
    compile_result = data.get("compile", {})
    run_result = data.get("run", {})

    # If compilation failed, surface the compile error as stderr
    if compile_result and compile_result.get("code", 0) != 0:
        return ExecuteResponse(
            stdout="",
            stderr=compile_result.get("stderr", "") or compile_result.get("output", "Compilation failed"),
            exit_code=compile_result.get("code", 1),
            execution_time=elapsed,
            language=runtime["language"],
            version=runtime["version"],
        )

    return ExecuteResponse(
        stdout=run_result.get("stdout", ""),
        stderr=run_result.get("stderr", ""),
        exit_code=run_result.get("code", 0),
        execution_time=elapsed,
        language=runtime["language"],
        version=runtime["version"],
    )
