"""
nvidia_service.py
Async helpers that call NVIDIA NIM API (OpenAI-compatible endpoint)
for AI-powered features used by the SmartApply API routers.

Free NVIDIA NIM API: https://build.nvidia.com/models
API Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
"""

import asyncio
import json
from typing import Optional

import httpx

from backend.config import NVIDIA_API_URL, NVIDIA_API_KEYS, NVIDIA_MODEL


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _chat(messages: list[dict], max_tokens: int = 600) -> str:
    """
    Single async NVIDIA NIM chat call.
    Tries every configured key in sequence; raises RuntimeError if all fail.
    Falls back through multiple free models if the primary returns null content.
    """
    keys = [k for k in NVIDIA_API_KEYS if k and k.startswith("nvapi-")]
    if not keys:
        raise RuntimeError(
            "No NVIDIA API keys configured. "
            "Set NVIDIA_API_KEYS=nvapi-xxxx in your .env or Render environment variables. "
            "Get a free key at https://build.nvidia.com/models"
        )

    # ── Verified model IDs on NVIDIA NIM (all FREE) ───────────────────────────
    # Primary model comes from config (NVIDIA_MODEL env var).
    # Fallbacks are tried in order if the primary fails or returns null content.
    models_to_try = [
        NVIDIA_MODEL,                              # from config (default: llama-3.3-70b)
        "meta/llama-3.3-70b-instruct",            # 70B — best overall ⭐
        "meta/llama-3.1-70b-instruct",            # 70B — Llama 3.1 fallback
        "google/gemma-3-27b-it",                  # 27B — fast and reliable
        "mistralai/mistral-7b-instruct-v0.3",     # 7B  — fastest fallback
        "nvidia/llama-3.1-nemotron-70b-instruct", # 70B — NVIDIA-tuned
        "mistralai/mixtral-8x7b-instruct-v0.1",  # 47B — Mixtral fallback
    ]

    # Deduplicate while preserving order
    seen: set = set()
    models_to_try = [m for m in models_to_try if not (m in seen or seen.add(m))]

    errors = []
    for key in keys:
        for model in models_to_try:
            try:
                async with httpx.AsyncClient(timeout=60) as client:   # 60s — generous for large models
                    resp = await client.post(
                        NVIDIA_API_URL,
                        headers={
                            "Authorization": f"Bearer {key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model,
                            "messages": messages,
                            "max_tokens": max_tokens,
                            "temperature": 0.2,
                        },
                    )

                    # 4xx errors on this model/key — record and try next
                    if resp.status_code in (400, 404, 422):
                        errors.append(f"[{model}] HTTP {resp.status_code}: {resp.text[:200]}")
                        continue

                    # 401/403 → bad key, no point trying other models with same key
                    if resp.status_code in (401, 403):
                        errors.append(f"[key={key[:12]}...] Auth error {resp.status_code}")
                        break  # break model loop, try next key

                    resp.raise_for_status()
                    data = resp.json()
                    content = (
                        data.get("choices", [{}])[0]
                            .get("message", {})
                            .get("content")
                    )
                    if content is None:
                        errors.append(f"[{model}] null content in response")
                        continue  # try next model
                    return content.strip()

            except httpx.TimeoutException:
                errors.append(f"[{model}] Timeout after 60s")
                continue
            except Exception as exc:
                errors.append(f"[{model}] {type(exc).__name__}: {exc}")
                continue

    raise RuntimeError(
        f"All NVIDIA API keys/models failed. Last errors: {'; '.join(errors[-5:])}"
    )


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
        if isinstance(skills, dict):
            for v in skills.values():
                if isinstance(v, list):
                    return [str(s) for s in v if s]
    except Exception:
        pass

    # Fallback: split by comma or newline
    return [s.strip().strip('"') for s in raw.replace("\n", ",").split(",") if s.strip()]


async def analyze_ats(resume_text: str, job_description: str = "") -> dict:
    """
    Full ATS resume analysis. Job description is optional.
    If provided, compares resume against JD. Otherwise does general ATS analysis.
    """
    has_jd = bool(job_description and len(job_description.strip()) > 20)

    if has_jd:
        system_context = (
            "Analyze the resume against the provided job description. "
            "matched_keywords and missing_keywords should reflect JD keywords. "
            "section_scores should reflect how well the resume fits the JD."
        )
        user_content = (
            f"JOB DESCRIPTION:\n{job_description[:3000]}\n\n"
            f"RESUME:\n{resume_text[:4000]}"
        )
    else:
        system_context = (
            "Analyze the resume for general ATS compatibility and quality. "
            "matched_keywords should list strong keywords present in the resume. "
            "missing_keywords should list commonly expected keywords that are absent. "
            "section_scores should reflect overall resume quality and ATS-friendliness."
        )
        user_content = f"RESUME:\n{resume_text[:4000]}"

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert ATS (Applicant Tracking System) resume analyzer. "
                f"{system_context} "
                "Return ONLY a valid JSON object with exactly this structure (no markdown, no explanation):\n"
                "{\n"
                '  "ats_score": <integer 0-100>,\n'
                '  "summary": "<2 sentence overall assessment>",\n'
                '  "matched_keywords": ["keyword1", "keyword2", ...],\n'
                '  "missing_keywords": ["keyword1", "keyword2", ...],\n'
                '  "section_scores": {\n'
                '    "skills_match": <0-100>,\n'
                '    "experience_relevance": <0-100>,\n'
                '    "education_match": <0-100>,\n'
                '    "keyword_density": <0-100>\n'
                '  },\n'
                '  "improvements": [\n'
                '    {"priority": "high"|"medium"|"low", "tip": "<actionable suggestion>"},\n'
                '    ...\n'
                '  ],\n'
                '  "strengths": ["<strength1>", "<strength2>", ...]\n'
                "}\n"
                "Be accurate and strict. ATS score reflects real ATS software likelihood of passing."
            ),
        },
        {
            "role": "user",
            "content": user_content,
        },
    ]

    raw = await _chat(messages, max_tokens=1200)

    # Strip markdown fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except Exception:
        return {
            "ats_score": 0,
            "summary": "Analysis failed — please try again.",
            "matched_keywords": [],
            "missing_keywords": [],
            "section_scores": {
                "skills_match": 0,
                "experience_relevance": 0,
                "education_match": 0,
                "keyword_density": 0,
            },
            "improvements": [{"priority": "high", "tip": "Could not parse AI response. Please retry."}],
            "strengths": [],
            "raw": raw,
        }
