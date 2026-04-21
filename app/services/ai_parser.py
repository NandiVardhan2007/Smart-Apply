"""
AI Router
=========
Centralised client pool for NVIDIA NIM (3-key rotation) and Google Gemini.
All services import from here — do not instantiate AsyncOpenAI elsewhere.
"""

import os
import json
import logging
import time
from typing import Optional
from openai import AsyncOpenAI
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model routing table — change model names here, not in individual services
# ---------------------------------------------------------------------------
MODELS = {
    # Fast & cheap: QA, search terms, resume parsing, automation terms, JS healing
    "fast":    "meta/llama-3.1-8b-instruct",

    # High quality: ATS analysis, LinkedIn optimization, email scanning, Jarvis chat
    "quality": "meta/llama-3.1-70b-instruct",

    # Long-context generation: LaTeX resume (6000+ token output)
    "gen":     "meta/llama-3.1-70b-instruct",

    # Vision: PDF visual scan, image input — requires Gemini
    "vision":  "gemini-2.0-flash",

    # Deep reasoning: Jarvis deep_think, complex analysis
    "pro":     "gemini-2.5-pro",
}

# ---------------------------------------------------------------------------
# Key loading
# ---------------------------------------------------------------------------
def _load_nvidia_keys() -> list:
    # Prefer comma-separated NVIDIA_NIM_KEYS env var (set this in Render)
    raw = os.getenv("NVIDIA_NIM_KEYS") or (settings.NVIDIA_NIM_KEYS or "")
    if raw.strip():
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        if keys:
            logger.info(f"[AI Router] Loaded {len(keys)} NVIDIA key(s) from NVIDIA_NIM_KEYS")
            return keys
    # Fallback to individual settings keys
    keys = [k for k in [
        settings.NVIDIA_NIM_KEY_1,
        settings.NVIDIA_NIM_KEY_2,
        settings.NVIDIA_NIM_KEY_3,
    ] if k]
    logger.info(f"[AI Router] Loaded {len(keys)} NVIDIA key(s) from individual settings")
    return keys

API_KEYS = _load_nvidia_keys()

# ---------------------------------------------------------------------------
# Client pool
# ---------------------------------------------------------------------------
_clients: list = [
    AsyncOpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=k)
    for k in API_KEYS
]

# Per-key cooldown: {key_index: monotonic_timestamp_when_cooldown_expires}
_key_cooldowns: dict = {}
_key_index: int = 0


def _is_key_on_cooldown(idx: int) -> bool:
    return time.monotonic() < _key_cooldowns.get(idx, 0)


def _put_key_on_cooldown(idx: int, minutes: int = 60):
    _key_cooldowns[idx] = time.monotonic() + minutes * 60
    logger.warning(f"[AI Router] NVIDIA key index {idx} rate-limited — cooldown for {minutes}min")


def _get_client_with_index():
    """Round-robin across keys, skipping any currently on cooldown."""
    global _key_index
    if not _clients:
        raise RuntimeError("No NVIDIA NIM API keys configured. Set NVIDIA_NIM_KEYS in Render.")

    for _ in range(len(_clients)):
        idx = _key_index % len(_clients)
        _key_index = idx + 1
        if not _is_key_on_cooldown(idx):
            return _clients[idx], idx

    # All keys on cooldown — use the one with the earliest expiry as emergency fallback
    best_idx = min(range(len(_clients)), key=lambda i: _key_cooldowns.get(i, 0))
    logger.error("[AI Router] All NVIDIA keys on cooldown — using emergency fallback key")
    return _clients[best_idx], best_idx


def get_next_client():
    """Compatibility shim — existing services call get_next_client() directly."""
    client, _ = _get_client_with_index()
    return client


# ---------------------------------------------------------------------------
# Unified NVIDIA call helper
# ---------------------------------------------------------------------------
async def call_nvidia(
    messages: list,
    model: str = None,
    temperature: float = 0.1,
    max_tokens: int = 1000,
    retries: int = 3,
) -> str:
    """
    Call NVIDIA NIM with automatic key rotation on 429 errors.
    All services should prefer this over calling get_next_client() directly.
    """
    if model is None:
        model = MODELS["fast"]

    last_err = None
    for attempt in range(retries):
        client, key_idx = _get_client_with_index()
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            last_err = e
            err_str = str(e)
            if "429" in err_str or "rate" in err_str.lower() or "quota" in err_str.lower():
                _put_key_on_cooldown(key_idx, minutes=60)
                logger.warning(f"[AI Router] Key {key_idx} rate-limited, rotating (attempt {attempt + 1}/{retries})")
            else:
                logger.error(f"[AI Router] NVIDIA non-rate error on attempt {attempt + 1}: {e}")
                if attempt >= 1:
                    break  # Don't burn retries on non-rate-limit errors

    raise last_err or RuntimeError("NVIDIA call failed after all retries")


# ---------------------------------------------------------------------------
# Gemini singleton & call helper
# ---------------------------------------------------------------------------
gemini_client = None
if settings.GOOGLE_API_KEY:
    try:
        gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        logger.info("[AI Router] Gemini client initialized successfully")
    except Exception as e:
        logger.error(f"[AI Router] Gemini init failed: {e}")


async def call_gemini(
    system_prompt: str,
    user_content: str,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.1,
    file_bytes: bytes = None,
    mime_type: str = "application/pdf",
) -> str:
    """
    Call Google Gemini. Supports optional file attachment for multimodal tasks.
    Raises RuntimeError if Gemini is not configured.
    """
    if not gemini_client:
        raise RuntimeError("Gemini not configured — GOOGLE_API_KEY missing")

    parts = [types.Part.from_text(text=user_content)]
    if file_bytes:
        parts.append(types.Part.from_bytes(data=file_bytes, mime_type=mime_type))

    response = gemini_client.models.generate_content(
        model=model,
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
        )
    )
    return (response.text or "").strip()


# ---------------------------------------------------------------------------
# parse_resume_with_ai — unchanged behaviour, now uses call_nvidia helper
# ---------------------------------------------------------------------------
async def parse_resume_with_ai(resume_text: str) -> dict:
    """Uses NVIDIA NIM (fast model) to extract structured data from resume text."""
    resume_text = resume_text[:6000]

    system_prompt = """Extract profile info from resume. Return ONLY JSON.
    First, determine if the input text is actually a resume/CV.
    Fields:
    isResume: boolean,
    firstName, lastName, email, phone, current_city, state, country, education, experience, skills, portfolioUrl, linkedinUrl, githubUrl.
    Use empty string if not found. No preamble."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Resume Text:\n{resume_text}"}
    ]

    try:
        raw = await call_nvidia(messages, model=MODELS["fast"], temperature=0.1, max_tokens=600)
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"[AI Parser] NVIDIA failed: {e}. Attempting Gemini fallback.")

    # Gemini fallback
    if settings.GOOGLE_API_KEY:
        try:
            raw = await call_gemini(system_prompt, f"Resume Text:\n{resume_text}", model="gemini-2.0-flash")
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            return json.loads(raw)
        except Exception as gemini_err:
            logger.error(f"[AI Parser] Gemini fallback failed: {gemini_err}")

    logger.error("[AI Parser] CRITICAL — both engines exhausted")
    return {
        "isResume": False, "firstName": "", "lastName": "", "email": "", "phone": "",
        "location": "", "education": "", "experience": "", "skills": "",
        "portfolioUrl": "", "linkedinUrl": "", "githubUrl": ""
    }


async def generate_automation_terms_with_ai(experience: str, skills: str, job_title: str) -> dict:
    """Uses fast model to generate LinkedIn search terms and bad words."""
    system_prompt = """Based on the user's experience and skills, generate:
    1. Search Terms: 5-8 highly relevant job titles or keywords for LinkedIn job search (comma-separated).
    2. Bad Words: 5-8 keywords to EXCLUDE.
    Return ONLY JSON with keys: 'search_terms' and 'bad_words'. No preamble."""

    user_input = f"Experience: {experience}\nSkills: {skills}\nTarget Job Title: {job_title}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]

    try:
        raw = await call_nvidia(messages, model=MODELS["fast"], temperature=0.4, max_tokens=300)
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"[AI Parser] Automation terms NVIDIA failed: {e}. Trying Gemini.")

    if settings.GOOGLE_API_KEY:
        try:
            raw = await call_gemini(system_prompt, user_input, model="gemini-2.0-flash", temperature=0.4)
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            return json.loads(raw)
        except Exception as gemini_err:
            logger.error(f"[AI Parser] Gemini fallback failed: {gemini_err}")

    return {"search_terms": "", "bad_words": ""}
