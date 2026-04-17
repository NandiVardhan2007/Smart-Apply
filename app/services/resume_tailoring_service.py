"""
Resume Tailoring & LaTeX Generation Service
============================================
Core AI engine that transforms a job description + user profile into a
fully tailored, ATS-friendly resume in compile-ready LaTeX format.

Uses NVIDIA NIM Llama 3.1 70B as the exclusive engine for reliability and quota management.
"""

import logging
import json
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.services.ai_parser import get_next_client
from app.utils.json_repair import robust_json_loads
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LaTeX template skeleton — proven ATS-friendly, single-column, no graphics
# ---------------------------------------------------------------------------
LATEX_TEMPLATE_HINT = r"""
% ATS-Friendly Resume Template — Single Column, No Graphics
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[margin=0.7in]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}
\usepackage{xcolor}

% Clean section formatting
\titleformat{\section}{\large\bfseries\uppercase}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{12pt}{6pt}

% Remove page numbers for single-page resumes
\pagestyle{empty}

% Tight lists
\setlist[itemize]{nosep, left=0pt .. 1.5em}

\begin{document}

% === HEADER ===
\begin{center}
  {\LARGE\textbf{FULL NAME}} \\[4pt]
  Phone $\mid$ Email $\mid$ Location \\
  \href{https://linkedin.com/in/handle}{LinkedIn} $\mid$
  \href{https://github.com/handle}{GitHub}
\end{center}

% === PROFESSIONAL SUMMARY ===
\section{Professional Summary}
2-3 sentence summary tailored to the target role...

% === SKILLS ===
\section{Skills}
\textbf{Languages:} Python, JavaScript, ... \\
\textbf{Frameworks:} React, FastAPI, ... \\
\textbf{Tools:} Docker, Git, AWS, ...

% === EXPERIENCE ===
\section{Experience}
\textbf{Job Title} \hfill Start -- End \\
\textit{Company Name} \hfill Location
\begin{itemize}
  \item Accomplished X by doing Y, resulting in Z
\end{itemize}

% === PROJECTS ===
\section{Projects}
\textbf{Project Name} $\mid$ \textit{Tech Stack} \hfill Date
\begin{itemize}
  \item Description of impact and outcome
\end{itemize}

% === EDUCATION ===
\section{Education}
\textbf{Degree} \hfill Graduation Date \\
\textit{Institution Name} \hfill Location

% === CERTIFICATIONS (optional) ===
\section{Certifications}
Certification Name -- Issuing Org (Year)

\end{document}
"""

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

JOB_ANALYSIS_PROMPT = """You are an expert job market analyst. Analyze the following job posting and extract structured information.

Return ONLY raw JSON matching this schema exactly:
{
  "job_title": "string",
  "seniority_level": "intern|entry|mid|senior|lead|executive",
  "company": "string",
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill1", "skill2"],
  "tools_technologies": ["tool1", "tool2"],
  "responsibilities": ["resp1", "resp2"],
  "keywords": ["keyword1", "keyword2"],
  "soft_skills": ["skill1", "skill2"],
  "domain": "string (e.g., fintech, healthcare, SaaS)"
}

RULES:
- Extract EVERY skill, tool, and technology mentioned.
- Identify the EXACT seniority level from context clues (years of experience, title).
- Keywords should include terms repeated 2+ times in the posting.
- NO preamble, NO markdown. ONLY raw JSON."""

TAILORING_SYSTEM_PROMPT = """You are an elite resume writer and ATS optimization specialist.
Your task is to generate a COMPLETE, COMPILE-READY LaTeX resume tailored to a specific job posting.

CRITICAL RULES:
1. OUTPUT ONLY VALID LaTeX CODE. No explanations, no markdown fences, no preamble.
2. The LaTeX MUST compile successfully with pdflatex.
3. Use ONLY the user's REAL data. NEVER invent experience, companies, metrics, certifications, or degrees.
4. If information is missing, use placeholders: [Add metric], [Company Name], [Project Name], [Your Achievement].
5. Keep the resume TRUTHFUL, CONCISE, and STRONG.
6. Use a SINGLE-COLUMN layout. No icons, tables, charts, logos, or complex formatting.
7. Use STRONG ACTION VERBS: Engineered, Orchestrated, Spearheaded, Transformed, Architected, Delivered.
8. Include MEASURABLE IMPACT when available (percentages, numbers, scale).
9. Naturally weave in job-relevant KEYWORDS without stuffing.
10. All LaTeX special characters must be properly escaped: &, %, $, #, _, {, }, ~, ^

LATEX STRUCTURE (in this order):
1. Document class and packages (article, geometry, enumitem, hyperref, titlesec)
2. Header: Name, phone, email, location, LinkedIn, GitHub/portfolio
3. Professional Summary: 2-3 sentences aligned with the target role
4. Skills: Grouped by category (Languages, Frameworks, Tools, etc.)
5. Experience: Reverse chronological, with impact-driven bullet points
6. Projects: Most relevant to the job, with tech stack and outcomes
7. Education: Degree, institution, dates
8. Certifications: If available
9. Additional sections only if relevant

TAILORING STRATEGY:
- For TECHNICAL roles: Surface relevant technical skills prominently, lead with engineering impact.
- For INTERNSHIP/ENTRY-LEVEL: Emphasize projects, coursework, certifications, and learning velocity.
- For CORPORATE roles: Emphasize reliability, ownership, communication, cross-functional impact.
- For STARTUP roles: Emphasize speed, versatility, product thinking, 0-to-1 execution.
- For ACADEMIC/RESEARCH roles: Emphasize research, publications, methodology, tools.

TEMPLATE REFERENCE:
""" + LATEX_TEMPLATE_HINT


class ResumeTailoringService:
    """Core service for AI-powered resume tailoring and LaTeX generation."""

    def __init__(self):
        self._setup_gemini()

    def _setup_gemini(self):
        """Initialize Gemini client if available."""
        self.gemini_available = False
        if settings.GOOGLE_API_KEY:
            try:
                from google import genai
                from google.genai import types
                self.genai = genai
                self.types = types
                self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
                self.gemini_available = True
                logger.info("[ResumeTailor] Gemini client initialized.")
            except Exception as e:
                logger.error(f"[ResumeTailor] Gemini init failed: {e}")

    async def analyze_job(self, job_text: str) -> Dict[str, Any]:
        """
        Analyze a job description and extract structured requirements.
        Returns a dict matching the JobAnalysis schema.
        """
        if not job_text or len(job_text.strip()) < 30:
            return {"error": "Job description is too short to analyze."}

        # Truncate to prevent token overflow
        job_text = job_text[:8000]

        user_prompt = f"Analyze this job posting:\n\n{job_text}"

        try:
            raw = await self._call_ai(JOB_ANALYSIS_PROMPT, user_prompt, temperature=0.1, max_tokens=2000)
            result = robust_json_loads(raw)
            if result:
                return result
            logger.warning(f"[ResumeTailor] Job analysis JSON parse failed: {raw[:300]}")
            return self._fallback_job_analysis(job_text)
        except Exception as e:
            logger.error(f"[ResumeTailor] Job analysis error: {e}")
            return self._fallback_job_analysis(job_text)

    async def tailor_and_generate(
        self,
        user_id: str,
        job_text: str,
        job_url: Optional[str] = None,
        style_hint: str = "professional"
    ) -> Dict[str, Any]:
        """
        Main entry point: Analyze job → Match user profile → Generate tailored LaTeX.

        Returns a complete response dict with latex_code, job_analysis, match_summary.
        """
        # 1. Analyze the job
        job_analysis = await self.analyze_job(job_text)

        # 2. Build user context from database
        user_context = await self._build_user_context(user_id)

        # 3. Build the tailoring prompt
        user_prompt = self._build_tailoring_prompt(
            job_text=job_text,
            job_analysis=job_analysis,
            user_context=user_context,
            style_hint=style_hint
        )

        # 4. Generate LaTeX
        latex_code = await self._call_ai(
            TAILORING_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.3,
            max_tokens=6000,
            prefer_pro=True  # Use the strongest model for LaTeX generation
        )

        # 5. Clean up the LaTeX output
        latex_code = self._clean_latex_output(latex_code)

        # 6. Build match summary
        match_summary = self._compute_match_summary(job_analysis, user_context)

        # 7. Persist to database
        db = get_database()
        doc = {
            "user_id": user_id,
            "job_title": job_analysis.get("job_title", "Unknown Position"),
            "company": job_analysis.get("company", "Unknown Company"),
            "job_url": job_url or "",
            "job_description": job_text[:5000],
            "job_analysis": job_analysis,
            "match_summary": match_summary,
            "latex_code": latex_code,
            "style_used": style_hint,
            "created_at": datetime.now(timezone.utc),
        }

        result = await db.tailored_resumes.insert_one(doc)
        doc_id = str(result.inserted_id)

        # 8. Retention: keep only last 5 per user
        await self._enforce_retention(user_id, limit=5)

        return {
            "id": doc_id,
            "job_title": doc["job_title"],
            "company": doc["company"],
            "latex_code": latex_code,
            "job_analysis": job_analysis,
            "match_summary": match_summary,
            "style_used": style_hint,
            "created_at": doc["created_at"].isoformat(),
        }

    # -----------------------------------------------------------------------
    # AI Call Logic with Gemini → NVIDIA NIM failover
    # -----------------------------------------------------------------------

    async def _call_ai(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 4000,
        prefer_pro: bool = False
    ) -> str:
        """Call NVIDIA NIM (Llama) directly for resume tasks to save Gemini quota."""
        # Per user request: use NVIDIA exclusively for resume tasks
        return await self._call_nvidia(system_prompt, user_prompt, temperature, max_tokens, prefer_pro)

    async def _call_gemini(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
        prefer_pro: bool
    ) -> str:
        """Call Gemini API."""
        model = "gemini-2.5-pro" if prefer_pro else "gemini-2.0-flash"

        response = self.client.models.generate_content(
            model=model,
            contents=[self.types.Content(
                role="user",
                parts=[self.types.Part.from_text(text=user_prompt)]
            )],
            config=self.types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature,
                max_output_tokens=max_tokens
            )
        )

        return (response.text or "").strip()

    async def _call_nvidia(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
        prefer_pro: bool
    ) -> str:
        """Call NVIDIA NIM (Llama) as fallback."""
        client = get_next_client()
        model = "meta/llama-3.1-70b-instruct" if prefer_pro else "meta/llama-3.1-8b-instruct"

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return (response.choices[0].message.content or "").strip()

    # -----------------------------------------------------------------------
    # User Context Builder
    # -----------------------------------------------------------------------

    async def _build_user_context(self, user_id: str) -> Dict[str, Any]:
        """Fetch and structure the user's profile data from MongoDB."""
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})

        if not user:
            return {"error": "User not found", "has_data": False}

        context = {
            "has_data": True,
            "name": user.get("full_name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "[Your Full Name]",
            "email": user.get("email", "[your.email@example.com]"),
            "phone": user.get("phone", "[Your Phone Number]"),
            "location": ", ".join(filter(None, [
                user.get("current_city", ""),
                user.get("state", ""),
                user.get("country", "")
            ])) or "[Your Location]",
            "linkedin": user.get("linkedin_url", ""),
            "github": user.get("github_url", ""),
            "portfolio": user.get("portfolio_url", ""),
            "education": user.get("education", ""),
            "experience": user.get("experience", ""),
            "skills": user.get("skills", ""),
            "cv_text": "",
        }

        # Get the default resume content if available
        resumes = user.get("resumes", [])
        default_resume = next((r for r in resumes if r.get("is_default")), None)
        if default_resume and default_resume.get("content"):
            context["cv_text"] = default_resume["content"][:6000]
        elif user.get("resume_content"):
            context["cv_text"] = user["resume_content"][:6000]

        return context

    # -----------------------------------------------------------------------
    # Prompt Builder
    # -----------------------------------------------------------------------

    def _build_tailoring_prompt(
        self,
        job_text: str,
        job_analysis: Dict,
        user_context: Dict,
        style_hint: str
    ) -> str:
        """Build the complete user prompt for LaTeX generation."""

        # Format user data
        user_section = "=== USER PROFILE DATA ===\n"
        user_section += f"Name: {user_context.get('name', '[Your Full Name]')}\n"
        user_section += f"Email: {user_context.get('email', '[your.email@example.com]')}\n"
        user_section += f"Phone: {user_context.get('phone', '[Your Phone Number]')}\n"
        user_section += f"Location: {user_context.get('location', '[Your Location]')}\n"

        if user_context.get("linkedin"):
            user_section += f"LinkedIn: {user_context['linkedin']}\n"
        if user_context.get("github"):
            user_section += f"GitHub: {user_context['github']}\n"
        if user_context.get("portfolio"):
            user_section += f"Portfolio: {user_context['portfolio']}\n"

        if user_context.get("skills"):
            user_section += f"\nSkills: {user_context['skills']}\n"
        if user_context.get("education"):
            user_section += f"\nEducation:\n{user_context['education']}\n"
        if user_context.get("experience"):
            user_section += f"\nExperience:\n{user_context['experience']}\n"
        if user_context.get("cv_text"):
            user_section += f"\nFull Resume Text (for reference):\n{user_context['cv_text']}\n"

        # Format job analysis
        job_section = "=== TARGET JOB ===\n"
        job_section += f"Title: {job_analysis.get('job_title', 'Unknown')}\n"
        job_section += f"Company: {job_analysis.get('company', 'Unknown')}\n"
        job_section += f"Seniority: {job_analysis.get('seniority_level', 'Unknown')}\n"
        job_section += f"Domain: {job_analysis.get('domain', 'Unknown')}\n"
        job_section += f"Required Skills: {', '.join(job_analysis.get('required_skills', []))}\n"
        job_section += f"Preferred Skills: {', '.join(job_analysis.get('preferred_skills', []))}\n"
        job_section += f"Tools/Technologies: {', '.join(job_analysis.get('tools_technologies', []))}\n"
        job_section += f"Key Responsibilities: {'; '.join(job_analysis.get('responsibilities', []))}\n"
        job_section += f"Important Keywords: {', '.join(job_analysis.get('keywords', []))}\n"
        job_section += f"Soft Skills: {', '.join(job_analysis.get('soft_skills', []))}\n"

        # Style instruction
        style_map = {
            "professional": "Use a clean, corporate professional tone. Emphasize reliability, ownership, and measurable impact.",
            "startup": "Use a dynamic, results-driven tone. Emphasize speed, versatility, product thinking, and 0-to-1 execution.",
            "academic": "Use a formal, research-oriented tone. Emphasize methodology, publications, tools, and academic rigor.",
            "entry_level": "Use an enthusiastic, growth-oriented tone. Emphasize projects, coursework, certifications, and learning velocity.",
        }
        style_instruction = style_map.get(style_hint, style_map["professional"])

        prompt = f"""{user_section}

{job_section}

=== RAW JOB DESCRIPTION ===
{job_text[:6000]}

=== STYLE INSTRUCTION ===
{style_instruction}

=== TASK ===
Generate a COMPLETE, COMPILE-READY LaTeX resume tailored to the target job.
- Use ONLY the user's real data above. Do NOT invent anything.
- If data is missing, use placeholders like [Add metric], [Company Name], etc.
- Prioritize the skills and experience most relevant to THIS specific job.
- Weave in the job's keywords naturally.
- Output ONLY the LaTeX code. No explanations."""

        return prompt

    # -----------------------------------------------------------------------
    # Post-processing
    # -----------------------------------------------------------------------

    def _clean_latex_output(self, raw: str) -> str:
        """Clean AI output to extract pure LaTeX code."""
        if not raw:
            return "% Error: No LaTeX generated. Please try again."

        # Strip markdown code fences
        cleaned = raw.strip()
        if cleaned.startswith("```latex"):
            cleaned = cleaned[len("```latex"):].strip()
        elif cleaned.startswith("```tex"):
            cleaned = cleaned[len("```tex"):].strip()
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:].strip()

        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

        # Ensure it starts with \documentclass
        if "\\documentclass" not in cleaned:
            # Wrap in a basic document structure
            cleaned = "\\documentclass[11pt,a4paper]{article}\n" + cleaned

        # Ensure it ends with \end{document}
        if "\\end{document}" not in cleaned:
            cleaned += "\n\\end{document}"

        return cleaned

    def _compute_match_summary(self, job_analysis: Dict, user_context: Dict) -> Dict:
        """Compute a simple match summary between job requirements and user profile."""
        user_skills_raw = (user_context.get("skills", "") or "").lower()
        user_experience_raw = (user_context.get("experience", "") or "").lower()
        user_cv_raw = (user_context.get("cv_text", "") or "").lower()
        all_user_text = f"{user_skills_raw} {user_experience_raw} {user_cv_raw}"

        required = job_analysis.get("required_skills", [])
        preferred = job_analysis.get("preferred_skills", [])
        tools = job_analysis.get("tools_technologies", [])

        all_required = required + tools
        matched = [s for s in all_required if s.lower() in all_user_text]
        missing = [s for s in all_required if s.lower() not in all_user_text]

        preferred_matched = [s for s in preferred if s.lower() in all_user_text]

        total = len(all_required) + len(preferred)
        found = len(matched) + len(preferred_matched)
        score = int((found / max(total, 1)) * 100)

        # Determine strategy
        seniority = job_analysis.get("seniority_level", "").lower()
        if seniority in ("intern", "entry"):
            strategy = "Projects and coursework emphasized over work experience."
        elif seniority in ("senior", "lead", "executive"):
            strategy = "Leadership, architecture decisions, and measurable impact emphasized."
        else:
            strategy = "Balanced approach: technical skills, project outcomes, and team contributions."

        # Identify placeholders
        placeholders = []
        if not user_context.get("experience"):
            placeholders.append("[Experience section] — No experience data found")
        if not user_context.get("education"):
            placeholders.append("[Education section] — No education data found")
        if not user_context.get("phone") or user_context.get("phone") == "[Your Phone Number]":
            placeholders.append("[Phone number] — Not provided")

        return {
            "matched_skills": matched,
            "missing_skills": missing,
            "matched_preferred": preferred_matched,
            "strongest_highlights": matched[:5],
            "placeholders_used": placeholders,
            "tailoring_score": min(score, 100),
            "strategy": strategy,
        }

    def _fallback_job_analysis(self, job_text: str) -> Dict:
        """Basic keyword extraction when AI analysis fails."""
        text_lower = job_text.lower()

        # Simple keyword extraction
        tech_keywords = [
            "python", "javascript", "typescript", "react", "node.js", "java", "c++",
            "aws", "docker", "kubernetes", "sql", "postgresql", "mongodb", "redis",
            "git", "ci/cd", "agile", "scrum", "rest", "api", "graphql", "terraform",
            "flask", "django", "fastapi", "spring", "angular", "vue", "next.js",
            "machine learning", "deep learning", "nlp", "computer vision",
        ]
        found_skills = [kw for kw in tech_keywords if kw in text_lower]

        return {
            "job_title": "Position",
            "seniority_level": "mid",
            "company": "Company",
            "required_skills": found_skills[:10],
            "preferred_skills": [],
            "tools_technologies": [],
            "responsibilities": [],
            "keywords": found_skills[:5],
            "soft_skills": [],
            "domain": "technology",
        }

    async def _enforce_retention(self, user_id: str, limit: int = 5):
        """Keep only the most recent `limit` tailored resumes per user."""
        db = get_database()
        cursor = db.tailored_resumes.find({"user_id": user_id}).sort("created_at", -1)
        all_docs = await cursor.to_list(length=100)

        if len(all_docs) > limit:
            ids_to_delete = [d["_id"] for d in all_docs[limit:]]
            await db.tailored_resumes.delete_many({"_id": {"$in": ids_to_delete}})
            logger.info(f"[ResumeTailor] Cleaned up {len(ids_to_delete)} old tailored resumes for user {user_id}")


# Singleton
resume_tailoring_service = ResumeTailoringService()
