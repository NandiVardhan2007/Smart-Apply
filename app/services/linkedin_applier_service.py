"""
LinkedIn Auto Applier Service
AI-powered job matching, question answering with memory integration,
and application tracking for the LinkedIn Auto Applier feature.
"""

import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from app.services.ai_parser import get_next_client
from app.services.memory_service import memory_service
from app.db.mongodb import get_database
from app.utils.json_repair import robust_json_loads
from app.utils.monitoring import log_resource_usage

logger = logging.getLogger(__name__)

LINKEDIN_QA_CATEGORY = "linkedin_qa"
LINKEDIN_PREFS_CATEGORY = "linkedin_preferences"


class LinkedInApplierService:
    """Handles AI-powered job search, question answering, and application tracking."""

    def __init__(self):
        self.collection_name = "linkedin_applications"

    # ── Search Term Generation ───────────────────────────────────────

    async def generate_search_terms(
        self,
        user_id: str,
        resume_text: Optional[str] = None,
        skills: Optional[str] = None,
        experience: Optional[str] = None,
        education: Optional[str] = None,
        location: Optional[str] = None,
        job_preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate AI-powered LinkedIn search queries and filters
        from the user's profile data and preferences.
        """
        # Build a rich context from all available user data
        profile_context = self._build_profile_context(
            resume_text, skills, experience, education, location, job_preferences
        )

        # Also pull any saved preferences from memory
        saved_prefs = await memory_service.get_memories(user_id, LINKEDIN_PREFS_CATEGORY)
        if saved_prefs:
            pref_text = "\n".join(
                f"- {m.get('key', '')}: {m.get('content', '')}" for m in saved_prefs
            )
            profile_context += f"\n\nSaved Job Preferences:\n{pref_text}"

        client = get_next_client()

        system_prompt = """You are a career expert AI. Generate optimized LinkedIn job search terms.
STRICT REQUIREMENT: Only target jobs with the "Easy Apply" feature.
Return ONLY valid JSON with these fields:
{
  "search_queries": ["query1", "query2", ...],  // 5-8 ranked LinkedIn search queries
  "keywords": ["kw1", "kw2", ...],              // 10-15 important keywords
  "job_titles": ["title1", "title2", ...],       // 5-10 matching job titles
  "filters": {
    "experience_level": "entry/mid/senior/executive",
    "job_type": "full-time/part-time/contract/internship",
    "remote": "remote/onsite/hybrid",
    "date_posted": "past_24h/past_week/past_month",
    "easy_apply": true                          // Always true
  },
  "linkedin_search_urls": ["url1", "url2", ...]  // 3-5 pre-built LinkedIn job search URLs
}
Make queries specific and targeted. LinkedIn search URLs MUST include the Easy Apply filter (f_AL=true).
Format: https://www.linkedin.com/jobs/search/?keywords=ENCODED_QUERY&location=LOCATION&f_AL=true
No preamble or explanation, ONLY the JSON object."""

        try:
            response = await client.chat.completions.create(
                model="meta/llama-3.1-8b-instruct",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"User Profile:\n{profile_context}"},
                ],
                temperature=0.3,
                max_tokens=1200,
            )

            raw = response.choices[0].message.content
            parsed = await asyncio.to_thread(robust_json_loads, raw)

            # Ensure all required fields exist with defaults
            result = {
                "search_queries": parsed.get("search_queries", []),
                "keywords": parsed.get("keywords", []),
                "job_titles": parsed.get("job_titles", []),
                "filters": parsed.get("filters", {}),
                "linkedin_search_urls": parsed.get("linkedin_search_urls", []),
            }

            logger.info(
                f"[LinkedIn Applier] Generated {len(result['search_queries'])} search queries for user {user_id}"
            )
            return result

        except Exception as e:
            logger.error(f"[LinkedIn Applier] Search term generation failed: {e}")
            # Fallback: construct basic queries from raw data
            return self._fallback_search_terms(skills, experience, location)

    # ── Question Answering ───────────────────────────────────────────

    async def answer_question(
        self,
        user_id: str,
        question: str,
        question_type: str = "text",
        options: Optional[List[str]] = None,
        job_title: Optional[str] = None,
        company_name: Optional[str] = None,
        job_description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Attempt to answer a LinkedIn application question using:
        1. Previously saved Q&A from memory (highest priority)
        2. User's resume/profile data
        3. AI generation with the user's context
        Falls back to requesting user input if confidence is low.
        """

        # ── Step 1: Check memory for exact or similar questions ──
        memory_answer = await self._find_answer_in_memory(user_id, question)
        if memory_answer:
            logger.info(f"[LinkedIn Applier] Found answer in memory for: {question[:50]}...")
            return {
                "answer": memory_answer,
                "confidence": 0.95,
                "source": "memory",
                "needs_user_input": False,
                "explanation": "Answer found from a previously saved response.",
            }

        # ── Step 2: Build context from user profile & resume ──
        user_context = await self._get_user_context(user_id)

        # ── Step 3: AI-powered answer generation ──
        client = get_next_client()

        options_text = ""
        if options:
            options_text = f"\nAvailable options: {', '.join(options)}"

        system_prompt = f"""You are an AI assistant helping a job applicant answer application questions.
Use the applicant's profile data to provide accurate, professional answers.

Rules:
- Answer concisely and professionally.
- For select/radio questions, choose the BEST matching option from the available options.
- For checkbox questions, select ALL relevant options.
- For text questions, keep answers to 1-3 sentences unless the question asks for detail.
- For number questions, return only a number.
- For "years of experience" questions: Calculate based on the resume dates. If not found, return 0 or NEEDS_USER_INPUT. Do NOT guess.
- STRICT GROUNDING: Answer ONLY based on the provided Applicant Profile and Resume.
- If you genuinely cannot determine the answer from the data, return EXACTLY: "NEEDS_USER_INPUT"
- Do NOT fabricate or hallucinate information.

Return ONLY valid JSON:
{
  "answer": "your answer here or NEEDS_USER_INPUT",
  "confidence": 0.0-1.0,
  "explanation": "brief reasoning"
}"""

        user_message = f"""Applicant Profile:
{user_context}

Job: {job_title or 'Not specified'} at {company_name or 'Not specified'}
{f'Job Description: {job_description[:500]}' if job_description else ''}

Question Type: {question_type}
Question: {question}{options_text}"""

        try:
            response = await client.chat.completions.create(
                model="meta/llama-3.1-8b-instruct",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
                max_tokens=400,
            )

            raw = response.choices[0].message.content
            parsed = await asyncio.to_thread(robust_json_loads, raw)

            answer = parsed.get("answer", "")
            confidence = float(parsed.get("confidence", 0.0))
            explanation = parsed.get("explanation", "")

            if answer == "NEEDS_USER_INPUT" or confidence < 0.6:
                return {
                    "answer": None,
                    "confidence": confidence,
                    "source": "unknown",
                    "needs_user_input": True,
                    "explanation": explanation or "Could not confidently answer this question. Please provide your response.",
                }

            return {
                "answer": answer,
                "confidence": confidence,
                "source": "ai",
                "needs_user_input": False,
                "explanation": explanation,
            }

        except Exception as e:
            logger.error(f"[LinkedIn Applier] Question answering failed: {e}")
            return {
                "answer": None,
                "confidence": 0.0,
                "source": "unknown",
                "needs_user_input": True,
                "explanation": f"AI service error. Please answer manually.",
            }

    # ── Save Answer to Memory ────────────────────────────────────────

    async def save_answer_to_memory(
        self,
        user_id: str,
        question: str,
        answer: str,
        job_title: Optional[str] = None,
        company_name: Optional[str] = None,
        question_type: str = "text",
    ) -> Dict[str, Any]:
        """Save a Q&A pair to the user's memory for future reuse."""
        from app.schemas.memory import MemoryCreate

        # Create a clean, searchable key from the question
        key = question.strip().lower()[:200]

        memory_data = MemoryCreate(
            category=LINKEDIN_QA_CATEGORY,
            key=key,
            content=answer,
            metadata={
                "original_question": question,
                "question_type": question_type,
                "job_title": job_title,
                "company_name": company_name,
                "saved_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        result = await memory_service.create_memory(user_id, memory_data)
        logger.info(f"[LinkedIn Applier] Saved Q&A to memory for user {user_id}: {question[:50]}...")
        return result

    # ── Application Tracking ─────────────────────────────────────────

    async def log_application(
        self,
        user_id: str,
        job_title: str,
        company_name: str,
        job_url: str,
        status: str = "applied",
        notes: Optional[str] = None,
        questions_answered: int = 0,
        questions_manual: int = 0,
    ) -> Dict[str, Any]:
        """Log a LinkedIn job application to the database."""
        db = get_database()

        doc = {
            "user_id": user_id,
            "job_title": job_title,
            "company_name": company_name,
            "job_url": job_url,
            "status": status,
            "notes": notes,
            "questions_answered": questions_answered,
            "questions_manual": questions_manual,
            "created_at": datetime.now(timezone.utc),
        }

        result = await db[self.collection_name].insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)

        # Also update the applications collection used by the dashboard
        dashboard_doc = {
            "user_id": user_id,
            "job_title": job_title,
            "company_name": company_name,
            "job_url": job_url,
            "status": "Pending" if status == "applied" else status.capitalize(),
            "source": "linkedin_auto_applier",
            "created_at": datetime.now(timezone.utc),
        }
        await db.applications.insert_one(dashboard_doc)

        logger.info(
            f"[LinkedIn Applier] Logged application: {job_title} at {company_name} [{status}]"
        )
        return doc

    async def get_application_history(
        self, user_id: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get the user's LinkedIn application history."""
        db = get_database()
        cursor = (
            db[self.collection_name]
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(limit)
        )

        apps = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
            if isinstance(doc.get("created_at"), datetime):
                dt = doc["created_at"]
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                doc["created_at"] = dt.isoformat()
            apps.append(doc)

        return apps

    async def get_session_stats(self, user_id: str) -> Dict[str, Any]:
        """Get today's application stats for the user."""
        db = get_database()
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        total_today = await db[self.collection_name].count_documents(
            {"user_id": user_id, "created_at": {"$gte": today_start}}
        )
        applied_today = await db[self.collection_name].count_documents(
            {
                "user_id": user_id,
                "status": "applied",
                "created_at": {"$gte": today_start},
            }
        )
        total_all = await db[self.collection_name].count_documents(
            {"user_id": user_id}
        )

        return {
            "today_total": total_today,
            "today_applied": applied_today,
            "all_time_total": total_all,
        }

    # ── Private Helpers ──────────────────────────────────────────────

    def _build_profile_context(
        self,
        resume_text: Optional[str],
        skills: Optional[str],
        experience: Optional[str],
        education: Optional[str],
        location: Optional[str],
        job_preferences: Optional[Dict[str, Any]],
    ) -> str:
        """Build a rich text context from all available profile data."""
        parts = []
        if resume_text:
            parts.append(f"Resume:\n{resume_text[:3000]}")
        if skills:
            parts.append(f"Skills: {skills}")
        if experience:
            parts.append(f"Experience: {experience}")
        if education:
            parts.append(f"Education: {education}")
        if location:
            parts.append(f"Location: {location}")
        if job_preferences:
            prefs = ", ".join(f"{k}: {v}" for k, v in job_preferences.items())
            parts.append(f"Preferences: {prefs}")
        return "\n\n".join(parts) if parts else "No profile data available."

    async def _find_answer_in_memory(
        self, user_id: str, question: str
    ) -> Optional[str]:
        """Search memory for a previously saved answer to a similar question."""
        # Normalize the question for matching
        normalized = question.strip().lower()

        # Search for exact key match first
        memories = await memory_service.get_memories(user_id, LINKEDIN_QA_CATEGORY)
        for mem in memories:
            stored_key = mem.get("key", "").strip().lower()
            # Exact match
            if stored_key == normalized[:200]:
                return mem.get("content")
            # Fuzzy match: check if core words overlap significantly
            if self._questions_similar(normalized, stored_key):
                return mem.get("content")

        # Also try regex search
        try:
            # Extract key words from the question (first few significant words)
            words = [w for w in normalized.split() if len(w) > 3][:5]
            if words:
                search_term = words[0]  # Search by the most significant word
                search_results = await memory_service.search_memories(
                    user_id, search_term
                )
                for mem in search_results:
                    if mem.get("category") == LINKEDIN_QA_CATEGORY:
                        stored_q = (
                            mem.get("metadata", {})
                            .get("original_question", "")
                            .lower()
                        )
                        if self._questions_similar(normalized, stored_q):
                            return mem.get("content")
        except Exception:
            pass

        return None

    def _questions_similar(self, q1: str, q2: str) -> bool:
        """Check if two questions are similar enough to reuse the answer."""
        if not q1 or not q2:
            return False

        # Simple word overlap similarity
        words1 = set(w for w in q1.split() if len(w) > 3)
        words2 = set(w for w in q2.split() if len(w) > 3)

        if not words1 or not words2:
            return False

        overlap = len(words1 & words2)
        total = max(len(words1), len(words2))
        similarity = overlap / total

        return similarity >= 0.7

    async def _get_user_context(self, user_id: str) -> str:
        """Build user context from database profile + resume data."""
        db = get_database()

        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = None

        if not user:
            return "No profile data available."

        parts = []
        if (user.get("full_name")):
            parts.append(f"Name: {user['full_name']}")
        if (user.get("email")):
            parts.append(f"Email: {user['email']}")
        if (user.get("phone")):
            parts.append(f"Phone: {user['phone']}")
        if (user.get("location")):
            parts.append(f"Location: {user['location']}")
        if (user.get("education")):
            parts.append(f"Education: {user['education']}")
        if (user.get("experience")):
            parts.append(f"Experience: {user['experience']}")
        if (user.get("skills")):
            parts.append(f"Skills: {user['skills']}")
        if (user.get("linkedin_url")):
            parts.append(f"LinkedIn: {user['linkedin_url']}")
        if (user.get("github_url")):
            parts.append(f"GitHub: {user['github_url']}")
        if (user.get("portfolio_url")):
            parts.append(f"Portfolio: {user['portfolio_url']}")
        
        # NEW: Include full resume content for data-rich answering
        if (user.get("resume_content")):
            parts.append(f"FULL RESUME TEXT:\n{user['resume_content'][:8000]}")
            
        return "\n".join(parts) if parts else "Minimal profile data available."

    def _fallback_search_terms(
        self,
        skills: Optional[str],
        experience: Optional[str],
        location: Optional[str],
    ) -> Dict[str, Any]:
        """Generate basic search terms without AI when the service fails."""
        queries = []
        keywords = []

        if skills:
            skill_list = [s.strip() for s in skills.split(",")][:5]
            keywords = skill_list
            queries.append(" ".join(skill_list[:3]))

        if experience:
            queries.append(experience[:100])

        if not queries:
            queries = ["software engineer", "developer"]

        loc = location or ""
        urls = []
        for q in queries[:3]:
            encoded = q.replace(" ", "%20")
            url = f"https://www.linkedin.com/jobs/search/?keywords={encoded}"
            if loc:
                url += f"&location={loc.replace(' ', '%20')}"
            urls.append(url)

        return {
            "search_queries": queries,
            "keywords": keywords,
            "job_titles": queries[:3],
            "filters": {},
            "linkedin_search_urls": urls,
        }


linkedin_applier_service = LinkedInApplierService()
