"""
nvidia_service.py
Async helpers that call NVIDIA NIM API for SmartApply AI features.

ATS Analyzer improvements based on resume-AI research:
- Separate REQUIRED vs NICE-TO-HAVE skill weighting
- Semantic synonym matching (not just exact keywords)
- Section-by-section scoring (skills_match, experience_relevance, education_match, keyword_density)
- Actionable improvement tips categorized by priority (high/medium/low)
- ATS formatting checks (single-column, no tables/images, standard headings)
- Bias-aware: avoids scoring on protected attributes
- Returns matched_keywords, missing_keywords, strengths, improvements
"""

import asyncio
import json
import re
from typing import Optional

import httpx

from backend.config import NVIDIA_API_URL, NVIDIA_API_KEYS, NVIDIA_MODEL


# ── Core chat helper ──────────────────────────────────────────────────────────

async def _chat(messages: list[dict], max_tokens: int = 800) -> str:
    keys = [k for k in NVIDIA_API_KEYS if k and k.startswith("nvapi-")]
    if not keys:
        raise RuntimeError(
            "No NVIDIA API keys configured. "
            "Set NVIDIA_API_KEYS=nvapi-xxxx in your .env or Render environment."
        )

    models_to_try = list(dict.fromkeys([
        NVIDIA_MODEL,
        "meta/llama-3.3-70b-instruct",
        "meta/llama-3.1-70b-instruct",
        "google/gemma-3-27b-it",
        "mistralai/mistral-7b-instruct-v0.3",
    ]))

    errors = []
    for key in keys:
        for model in models_to_try:
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(
                        NVIDIA_API_URL,
                        headers={
                            "Authorization": f"Bearer {key}",
                            "Content-Type":  "application/json",
                        },
                        json={
                            "model":       model,
                            "messages":    messages,
                            "max_tokens":  max_tokens,
                            "temperature": 0.15,
                        },
                    )

                if resp.status_code in (400, 404, 422):
                    errors.append(f"[{model}] HTTP {resp.status_code}")
                    continue
                if resp.status_code in (401, 403):
                    errors.append(f"[key={key[:12]}...] Auth {resp.status_code}")
                    break

                resp.raise_for_status()
                data    = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content")
                if content is None:
                    errors.append(f"[{model}] null content")
                    continue
                return content.strip()

            except httpx.TimeoutException:
                errors.append(f"[{model}] Timeout")
                continue
            except Exception as exc:
                errors.append(f"[{model}] {type(exc).__name__}: {exc}")
                continue

    raise RuntimeError(
        f"All NVIDIA API keys/models failed. Errors: {'; '.join(errors[-5:])}"
    )


def _clean_json(raw: str) -> str:
    """Strip markdown fences from a JSON response."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


# ── Job question answering ─────────────────────────────────────────────────────

async def answer_job_question(
    question: str,
    user_info: str,
    options: Optional[list[str]] = None,
) -> str:
    options_block = ""
    if options:
        options_block = "\n\nOPTIONS (pick one exactly):\n" + "\n".join(f"- {o}" for o in options)

    messages = [
        {
            "role": "system",
            "content": (
                "You are an AI filling out a job application form on behalf of a candidate. "
                "Rules:\n"
                "• Numeric fields (years, salary) → return ONLY the number.\n"
                "• Yes/No questions → return ONLY 'Yes' or 'No'.\n"
                "• Short text → one clear sentence.\n"
                "• Long text → max 3 sentences, under 350 characters.\n"
                "Never repeat the question. Use the candidate profile provided."
            ),
        },
        {
            "role": "user",
            "content": f"Candidate profile:\n{user_info}\n\nQuestion: {question}{options_block}",
        },
    ]
    return await _chat(messages, max_tokens=300)


# ── Cover letter ───────────────────────────────────────────────────────────────

async def generate_cover_letter(
    user_info: str,
    job_title: str,
    company: str,
    job_description: str = "",
) -> str:
    jd_section = f"\n\nJob Description (use this to tailor the letter):\n{job_description[:2000]}" if job_description else ""

    messages = [
        {
            "role": "system",
            "content": (
                "You are a professional cover letter writer specializing in the Indian job market. "
                "Write a concise, personalized cover letter (3 short paragraphs, max 220 words). "
                "Rules:\n"
                "• Start with 'Dear Hiring Manager,'\n"
                "• Paragraph 1: Who the candidate is and why they fit this specific role.\n"
                "• Paragraph 2: One or two specific accomplishments relevant to the JD.\n"
                "• Paragraph 3: Availability and call-to-action.\n"
                "• End with 'Best regards, [Name]'\n"
                "• Do NOT use clichés like 'I am passionate', 'esteemed organization', 'dream company'.\n"
                "• Be specific — mention actual skills and experience from the profile."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Write a cover letter for: {job_title} at {company}."
                f"{jd_section}\n\nCandidate profile:\n{user_info}"
            ),
        },
    ]
    return await _chat(messages, max_tokens=600)


# ── Skill extraction from JD ───────────────────────────────────────────────────

async def extract_skills_from_description(job_description: str) -> list[str]:
    messages = [
        {
            "role": "system",
            "content": (
                "You are a skill extractor. From the job description, extract all required and "
                "preferred skills, tools, technologies, and qualifications. "
                "Return ONLY a JSON array of strings — no markdown, no explanation. "
                'Example: ["Python", "SQL", "AWS", "Communication", "Power BI"]'
            ),
        },
        {
            "role": "user",
            "content": f"Extract skills from:\n\n{job_description[:3000]}",
        },
    ]
    raw = await _chat(messages, max_tokens=400)
    raw = _clean_json(raw)

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

    return [s.strip().strip('"') for s in raw.replace("\n", ",").split(",") if s.strip()]


# ── ATS Resume Analyzer ────────────────────────────────────────────────────────
# Implements research-backed scoring:
# • REQUIRED vs NICE-TO-HAVE skill separation
# • Semantic understanding (not just exact keyword match)
# • Section-level scoring (skills, experience, education, formatting/density)
# • Priority-ranked improvement tips
# • ATS formatting checks
# • Strengths recognition

async def analyze_ats(resume_text: str, job_description: str = "") -> dict:
    has_jd = bool(job_description and len(job_description.strip()) > 20)

    if has_jd:
        jd_context = (
            "You are analyzing the resume AGAINST a specific job description (JD). "
            "Separate required vs nice-to-have skills from the JD. "
            "Penalize more heavily for missing REQUIRED skills. "
            "Give partial credit when the resume implies a skill without using the exact keyword "
            "(e.g. 'built ML pipelines' implies Machine Learning)."
        )
        content_block = (
            f"JOB DESCRIPTION:\n{job_description[:3000]}\n\n"
            f"RESUME:\n{resume_text[:4000]}"
        )
    else:
        jd_context = (
            "No JD provided. Analyze the resume for general ATS compatibility, "
            "writing quality, and employability. "
            "matched_keywords = strong keywords already present. "
            "missing_keywords = commonly expected skills/keywords absent from this type of resume."
        )
        content_block = f"RESUME:\n{resume_text[:4000]}"

    system_prompt = f"""You are an expert ATS (Applicant Tracking System) resume analyzer trained on 
research about how real ATS systems work (keyword weighting, NER parsing, semantic matching, bias detection).

{jd_context}

Scoring guidelines:
- ats_score (0-100): Overall ATS pass likelihood.
  • 0-40: Poor — likely filtered out by ATS.
  • 41-60: Fair — passes basic checks but misses key requirements.
  • 61-79: Good — will pass most ATS, but not optimized.
  • 80-100: Excellent — highly optimized for ATS and the role.

- section_scores (each 0-100):
  • skills_match: How well the candidate's skills match what's needed (required > nice-to-have).
  • experience_relevance: Titles, responsibilities, and quantified achievements match the role.
  • education_match: Education level/field matches requirements.
  • keyword_density: Right keywords present at appropriate frequency — penalize stuffing AND absence.

- matched_keywords: Skills/keywords FROM THE JD (or generally strong ones) that ARE in the resume.
  Include semantic matches (e.g. "built ETL pipelines" counts as "data pipeline" keyword).
- missing_keywords: Important skills/keywords that are ABSENT. Mark required ones with "(Required)" suffix.

- improvements: Prioritized, actionable tips — aim for 4-6 tips:
  • "high" priority: Missing required skills, poor ATS formatting (tables/columns/images), 
    no quantified results, missing critical sections (contact info, summary).
  • "medium" priority: Missing nice-to-have skills, weak action verbs, too short/long bullets.
  • "low" priority: Minor formatting tweaks, nice additions like certifications or portfolio.

- strengths: 2-4 concrete things the resume does well.

ATS formatting rules to check:
• Penalize: multiple columns, tables, images/graphics, text in header/footer, missing contact info.
• Reward: single column, standard section headings (Experience, Education, Skills), 
  quantified achievements (numbers/percentages), strong action verbs (Developed, Led, Increased),
  reverse chronological order, clean date formatting.

Return ONLY valid JSON matching this exact structure (no markdown, no preamble):
{{
  "ats_score": <integer 0-100>,
  "summary": "<2-sentence honest assessment of ATS readiness and fit>",
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword1 (Required)", "keyword2"],
  "section_scores": {{
    "skills_match": <0-100>,
    "experience_relevance": <0-100>,
    "education_match": <0-100>,
    "keyword_density": <0-100>
  }},
  "improvements": [
    {{"priority": "high|medium|low", "tip": "<specific, actionable suggestion>"}},
    ...
  ],
  "strengths": ["<specific strength>", ...]
}}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": content_block},
    ]

    raw = await _chat(messages, max_tokens=1400)
    raw = _clean_json(raw)

    try:
        result = json.loads(raw)
        # Validate and clamp scores
        result["ats_score"] = max(0, min(100, int(result.get("ats_score", 0))))
        ss = result.get("section_scores", {})
        for k in ["skills_match", "experience_relevance", "education_match", "keyword_density"]:
            ss[k] = max(0, min(100, int(ss.get(k, 0))))
        result["section_scores"] = ss
        # Ensure lists exist
        result.setdefault("matched_keywords", [])
        result.setdefault("missing_keywords", [])
        result.setdefault("improvements", [])
        result.setdefault("strengths", [])
        result.setdefault("summary", "")
        return result

    except Exception:
        return {
            "ats_score": 0,
            "summary": "Analysis could not be parsed. Please try again.",
            "matched_keywords": [],
            "missing_keywords": [],
            "section_scores": {
                "skills_match": 0,
                "experience_relevance": 0,
                "education_match": 0,
                "keyword_density": 0,
            },
            "improvements": [{"priority": "high", "tip": "AI response could not be parsed. Please retry."}],
            "strengths": [],
            "_raw": raw[:500],
        }


# ── Batch ATS pre-check (runs local checks before calling AI) ─────────────────
# Catches common ATS killers immediately without burning API quota.

def quick_ats_precheck(resume_text: str) -> list[dict]:
    """
    Rule-based pre-screening for obvious ATS killers.
    Returns list of high-priority issues found locally.
    Based on research: tables/columns, missing sections, no contact info.
    """
    issues = []
    text_lower = resume_text.lower()

    # Contact info check
    import re
    has_email = bool(re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", resume_text))
    has_phone = bool(re.search(r"(?:\+91[\s\-]?)?[6-9]\d{9}", resume_text))
    if not has_email:
        issues.append({"priority": "high", "tip": "No email address found. ATS systems require contact information to create a candidate profile."})
    if not has_phone:
        issues.append({"priority": "high", "tip": "No phone number found. Add your 10-digit Indian mobile number."})

    # Section headings check
    common_sections = ["experience", "education", "skills", "work history", "employment"]
    found_sections  = [s for s in common_sections if s in text_lower]
    if len(found_sections) < 2:
        issues.append({"priority": "high", "tip": "Standard section headings (Experience, Education, Skills) are not clearly detected. Use plain text headings — many ATS skip content in images or non-standard formatting."})

    # Quantification check
    has_numbers = bool(re.search(r"\d+\s*%|\d+\s*(?:years?|months?|crore|lakh|k\b|million|users?|clients?|team)", resume_text, re.I))
    if not has_numbers:
        issues.append({"priority": "medium", "tip": "No quantified achievements detected. Add numbers (e.g. 'Reduced processing time by 30%', 'Managed team of 5') — ATS and recruiters heavily weight measurable impact."})

    # Very short resume check
    word_count = len(resume_text.split())
    if word_count < 150:
        issues.append({"priority": "high", "tip": f"Resume appears very short ({word_count} words). A full resume should be 400-700 words. Ensure the full PDF text was extracted correctly."})

    # Summary/objective check
    has_summary = any(kw in text_lower for kw in ["summary", "objective", "profile", "about"])
    if not has_summary:
        issues.append({"priority": "medium", "tip": "No professional summary or objective section found. A 2-3 sentence summary at the top dramatically improves ATS keyword density and recruiter first impressions."})

    return issues
