import asyncio
import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.services.ai_parser import get_next_client
from app.services.memory_service import memory_service
from app.services.email import email_service
from app.db.mongodb import get_database
from app.schemas.memory import MemoryCreate

logger = logging.getLogger(__name__)

JARVIS_MEMORY_CATEGORY = "jarvis_context"
ADMIN_EMAIL = "kovvurinandivardhanreddy2007@gmail.com"

class JarvisService:
    # Keywords that hint the user is reporting a bug or giving feedback
    _FEEDBACK_KEYWORDS = ["bug", "error", "crash", "broken", "not working", "issue", "problem", "fix", "glitch", "feedback", "suggestion", "improve", "report"]

    async def chat(self, user_id: str, message: str, history: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Core conversational logic for JARVIS — natural language first, no JSON requirement on the LLM."""
        
        # 1. Gather context
        user_context = await self._get_full_user_context(user_id)
        app_stats = await self._get_app_stats(user_id)
        
        # 2. Build system prompt — NO JSON formatting requirement.
        #    Let the model speak naturally. We handle structuring on the backend.
        system_prompt = f"""You are JARVIS, an advanced AI career assistant for the SmartApply platform.
SmartApply helps users automate job applications on LinkedIn and optimize their profiles.

Your Personality:
- Professional, intelligent, yet approachable and friendly.
- Like a trusted companion who truly wants the user to succeed in their career.
- Use a warm, natural conversational flow. Never be robotic.

Your Capabilities:
- Troubleshoot app issues (Auto-Applier stops, profile errors).
- Suggest profile improvements (ATS score, keyword optimization).
- Remember user preferences and career goals.
- Acknowledge bugs or suggestions and assure the user you'll inform the developer.

Safety & Accuracy:
- Only provide advice related to career, job applications, and the SmartApply platform.
- Do NOT provide medical, legal, or financial advice.
- If unsure about a user query, ask clarifying questions instead of guessing.
- Ground your responses in the user's actual data shown below.

User Context:
{user_context}

App Stats:
{app_stats}

Instructions:
- Respond naturally in plain text. Do NOT wrap your reply in JSON or code blocks.
- Keep responses concise (2-4 paragraphs max) and actionable.
- At the end of your reply, suggest 2-3 short follow-up actions the user can take, each on a new line starting with ">>".
  Example:
  >> Check your ATS score
  >> Update your skills
  >> Try Auto Pilot"""

        # 3. Call AI
        client = get_next_client()
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add limited history with role mapping safety
        if history:
            for h in history[-6:]:
                role = h.get("role", "user")
                if role.lower() not in ["user", "system", "assistant", "developer"]:
                    role = "assistant"
                messages.append({"role": role, "content": h.get("content", "")})
        
        messages.append({"role": "user", "content": message})

        try:
            response = await client.chat.completions.create(
                model="meta/llama-3.1-70b-instruct",
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )
            
            raw = (response.choices[0].message.content or "").strip()
            if not raw:
                return self._get_fallback_response("I seem to have lost my train of thought. Could you try again?")

            # 4. Extract suggestions from ">>" lines, then clean them from the main reply
            reply, suggestions = self._extract_suggestions(raw)
            
            # 5. Lightweight intent detection — keyword based, no extra AI call needed
            memory_updated = False
            action_taken = None
            msg_lower = message.lower()

            # A. Feedback / Bug report detection
            if any(kw in msg_lower for kw in self._FEEDBACK_KEYWORDS):
                summary = message[:100]
                asyncio.create_task(self._report_to_admin(user_id, message, summary))
                action_taken = "Feedback reported to admin"
                logger.info(f"[JARVIS] Detected feedback intent from user {user_id}")

            # B. Memory detection — if the user explicitly shares a preference
            memory_keywords = ["i prefer", "i like", "i want", "my goal", "i'm looking for", "i am looking for", "i'm interested in", "i am interested in"]
            if any(kw in msg_lower for kw in memory_keywords):
                try:
                    # Store the user's stated preference as a memory
                    key = f"user_preference_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
                    await memory_service.create_memory(user_id, MemoryCreate(
                        category=JARVIS_MEMORY_CATEGORY,
                        key=key,
                        content=message,
                        metadata={"source": "jarvis_chat", "timestamp": datetime.now(timezone.utc).isoformat()}
                    ))
                    memory_updated = True
                    logger.info(f"[JARVIS] Stored new memory for user {user_id}: {key}")
                except Exception as mem_err:
                    logger.error(f"[JARVIS] Memory storage failed: {mem_err}")

            return {
                "message": reply,
                "suggestions": suggestions,
                "memory_updated": memory_updated,
                "action_taken": action_taken
            }

        except Exception as e:
            logger.error(f"[JARVIS] Chat Critical Error: {e}", exc_info=True)
            return self._get_fallback_response("I apologize, but I am currently experiencing a connection delay. Please try again in a moment.")

    @staticmethod
    def _extract_suggestions(raw: str) -> tuple:
        """Parse '>>' suggestion lines from the AI's natural text reply."""
        lines = raw.split("\n")
        reply_lines = []
        suggestions = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(">>"):
                suggestion = stripped.lstrip(">").strip()
                if suggestion:
                    suggestions.append(suggestion)
            else:
                reply_lines.append(line)
        
        reply = "\n".join(reply_lines).strip()
        # Provide default suggestions if the model didn't generate any
        if not suggestions:
            suggestions = ["Check ATS Score", "Update Profile", "Try Auto Pilot"]
        return reply, suggestions

    def _get_fallback_response(self, error_msg: str) -> Dict[str, Any]:
        return {
            "message": error_msg,
            "suggestions": ["Try again", "Go to Dashboard"],
            "memory_updated": False,
            "error": True
        }

    async def _get_full_user_context(self, user_id: str) -> str:
        db = get_database()
        from bson import ObjectId
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user: return "Unknown user"
        
        parts = [
            f"Name: {user.get('full_name', 'User')}",
            f"Skills: {user.get('skills', 'Not set')}",
            f"Location: {user.get('current_city', '')}, {user.get('state', '')}, {user.get('country', '')}"
        ]
        
        # Pull latest ATS scan to answer query about ATS score
        try:
            cursor = db.ats_scans.find({"user_id": user_id}).sort("created_at", -1).limit(1)
            scans = await cursor.to_list(length=1)
            if scans:
                s = scans[0]
                parts.append(f"Latest ATS Scan:\n- Score: {s.get('overall_score', 'N/A')}\n- Grade: {s.get('overall_grade', 'N/A')}\n- Summary Feedback: {s.get('summary', '')}")
            else:
                parts.append("Latest ATS Scan: The user hasn't uploaded a resume for ATS scanning yet.")
        except Exception as e:
            logger.error(f"[JARVIS] ATS scan fetch error: {e}")

        # Pull latest memories
        mems = await memory_service.get_memories(user_id)
        if mems:
            insights = "\n".join([f"- {m.get('key')}: {m.get('content')}" for m in mems[:10]])
            parts.append(f"Known Insights:\n{insights}")
            
        return "\n".join(parts)

    async def _get_app_stats(self, user_id: str) -> str:
        from app.services.linkedin_applier_service import linkedin_applier_service
        stats = await linkedin_applier_service.get_session_stats(user_id)
        return json.dumps(stats)

    async def _report_to_admin(self, user_id: str, user_input: str, summary: str):
        db = get_database()
        from bson import ObjectId
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        user_email = user.get("email", "Unknown")
        
        subject = f"JARVIS Report: {summary[:50]}"
        body = f"""
        <h3>JARVIS Feedback/Bug Report</h3>
        <p><b>User Email:</b> {user_email}</p>
        <p><b>Summary:</b> {summary}</p>
        <p><b>Full Conversation Fragment:</b></p>
        <blockquote>{user_input}</blockquote>
        <hr>
        <p><i>This report was automatically generated by JARVIS.</i></p>
        """
        
        try:
            await email_service.send_email(
                recipient_email=ADMIN_EMAIL,
                subject=subject,
                html_content=body
            )
            logger.info(f"JARVIS reported feedback from {user_email} to admin.")
        except Exception as e:
            logger.error(f"JARVIS Failed to send report email: {e}")

jarvis_service = JarvisService()
