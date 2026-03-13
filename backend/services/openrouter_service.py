"""
openrouter_service.py
Async helpers that call OpenRouter (or any OpenAI-compatible endpoint)
for AI-powered features used by the SmartApply API routers.
"""

import asyncio
import json
from typing import Optional

import httpx

from backend.config import OPENROUTER_API_URL, OPENROUTER_KEYS, OPENROUTER_MODEL


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_key() -> str:
    """Return the first available OpenRouter key, or empty string."""
    for k in OPENROUTER_KEYS:
        if k and not k.startswith("sk-or-v1-YOUR"):
            return k
    return ""


async def _chat(messages: list[dict], max_tokens: int = 600) -> str:
    """
    Single async OpenRouter chat call.
    Tries every configured key in sequence; raises RuntimeError if all fail.
    """
    keys = [k for k in OPENROUTER_KEYS if k and not k.startswith("sk-or-v1-YOUR")]
    if not keys:
        raise RuntimeError("No OpenRouter API keys configured.")

    errors = []
    for key in keys:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    OPENROUTER_API_URL,
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:8000",
                        "X-Title": "SmartApply",
                    },
                    json={
                        "model": OPENROUTER_MODEL,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.2,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            errors.append(str(exc))
            continue

    raise RuntimeError(f"All OpenRouter keys failed: {'; '.join(errors)}")


# ── Public API (used by routers/ai.py) ───────────────────────────────────────

async def answer_job_question(
    question: str,
    user_info: str,
    options: Optional[list[str]] = None,
) -> str:
    """
    Answer a job-application question using the candidate's profile info.
    Supports text, Yes/No, and multiple-choice questions.
    """
    options_block = ""
    if options:
        options_block = "\n\nOPTIONS (choose one):\n" + "\n".join(f"- {o}" for o in options)

    messages = [
        {
            "role": "system",
            "content": (
                "You are an AI assistant filling out a job application form on behalf of a candidate. "
                "Answer concisely and professionally:\n"
                "• Numeric questions (years of experience, salary) → return only the number.\n"
                "• Yes/No questions → return only 'Yes' or 'No'.\n"
                "• Short answer → one sentence.\n"
                "• Long answer → max 3 sentences, under 350 characters.\n"
                "Never repeat the question. Use the candidate info provided."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Candidate info:\n{user_info}\n\n"
                f"Question: {question}"
                f"{options_block}"
            ),
        },
    ]
    return await _chat(messages, max_tokens=300)


async def generate_cover_letter(
    user_info: str,
    job_title: str,
    company: str,
) -> str:
    """Generate a personalised cover letter for the given job."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a professional cover letter writer. "
                "Write a concise, enthusiastic cover letter (3 short paragraphs, under 250 words). "
                "Start with 'Dear Hiring Manager,' and end with 'Best regards, [Name]'."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Write a cover letter for the role of {job_title} at {company}.\n\n"
                f"Candidate profile:\n{user_info}"
            ),
        },
    ]
    return await _chat(messages, max_tokens=500)


async def extract_skills_from_description(job_description: str) -> list[str]:
    """
    Extract a deduplicated list of skills from a job description.
    Returns a list of skill strings.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a skill extractor. Given a job description, return ONLY a JSON array "
                "of skill strings — no markdown, no explanation. "
                'Example: ["Python", "SQL", "Communication", "Power BI"]'
            ),
        },
        {
            "role": "user",
            "content": f"Extract all skills from this job description:\n\n{job_description[:3000]}",
        },
    ]
    raw = await _chat(messages, max_tokens=400)

    # Strip markdown fences if the model added them
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        skills = json.loads(raw)
        if isinstance(skills, list):
            return [str(s) for s in skills if s]
        # Some models return {"skills": [...]}
        if isinstance(skills, dict):
            for v in skills.values():
                if isinstance(v, list):
                    return [str(s) for s in v if s]
    except Exception:
        pass

    # Fallback: split by comma or newline
    return [s.strip().strip('"') for s in raw.replace("\n", ",").split(",") if s.strip()]
