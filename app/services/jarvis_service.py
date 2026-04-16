import asyncio
import logging
import json
from typing import List, Dict, Any, Optional
import base64
import traceback
from datetime import timezone, datetime

from app.services.ai_parser import get_next_client
from app.services.memory_service import memory_service
from app.services.email import email_service
from app.db.mongodb import get_database
from app.core.config import settings
from app.schemas.memory import MemoryCreate
from bson import ObjectId

logger = logging.getLogger(__name__)

JARVIS_MEMORY_CATEGORY = "jarvis_context"

class JarvisService:
    # Keywords that hint the user is reporting a bug, giving feedback, or requesting support
    _FEEDBACK_KEYWORDS = ["bug", "error", "crash", "broken", "not working", "glitch", "failure", "broken link", "not loading", "report a bug", "report an issue", "app is down"]

    async def chat(self, user_id: str, message: str, history: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Core conversational logic for JARVIS — natural language first, no JSON requirement on the LLM."""
        
        # 1. Gather context & preferred model
        db = get_database()
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        preferred_model = user_doc.get("preferred_ai_model", "meta/llama-3.1-70b-instruct") if user_doc else "meta/llama-3.1-70b-instruct"
        
        user_context = await self._get_full_user_context(user_id)
        app_stats = await self._get_app_stats(user_id)
        
        # 2. Build system prompt — focusing on Career Strategy and App Support.
        system_prompt = f"""You are JARVIS, an advanced AI career assistant for the SmartApply platform.
SmartApply helps users automate job applications on LinkedIn and optimize their profiles.

Your Personality:
- Professional, intelligent, yet approachable and friendly.
- Like a trusted companion who truly wants the user to succeed in their career.
- Use a warm, natural conversational flow. Never be robotic.
- **BILINGUAL SUPPORT**: You are fluent in both English and Telugu. If the user speaks to you in Telugu, respond in Telugu.
- **BUG REPORTING**: If (and ONLY if) the user is reporting a technical bug, crash, or failure in the application, include the tag `[ACTION: REPORT_BUG]` at the very end of your response.

Your Capabilities:
- Troubleshoot app issues (Auto-Applier stops, profile errors).
- Suggest profile improvements (ATS score, keyword optimization).
- Strategy coaching: Advise on how to network, interview, and optimize LinkedIn activities.

- **INTEGRATED CAPABILITIES**: You are fully integrated with the SmartApply platform. You HAVE the ability to:
  - Analyze live application data.
  - Send feedback reports to the engineering team.
  - Apply to LinkedIn listings automatically via the Auto-Applier.
  - **NEVER say you are a 'virtual assistant'.** You are JARVIS.

- **DYNAMIC INTELLIGENCE**: You can switch your own neural engine (AI Model).
  - Your Current Active Engine: {preferred_model}
  - Available Neural Engines:
    * `meta/llama-3.1-8b-instruct` (Fastest)
    * `meta/llama-3.1-70b-instruct` (Balanced - Default)
    * `meta/llama-3.1-405b-instruct` (Maximum power)
  - To switch, output: `[ACTION: SWITCH_MODEL|model_id]`

User Context:
{user_context}

App Stats:
{app_stats}

Instructions:
- Respond naturally in plain text.
- Keep responses concise (2-4 paragraphs max).
- At the end of your reply, suggest 2-3 short follow-up actions starting with ">>".
  Example:
  >> Check my ATS score
  >> Start Auto Applier
  >> Optimize my skills
"""

        # 3. Call AI
        client = get_next_client()
        messages = [{"role": "system", "content": system_prompt}]
        
        if history:
            for h in history[-6:]:
                role = h.get("role", "user")
                if role.lower() not in ["user", "system", "assistant", "developer"]:
                    role = "assistant"
                messages.append({"role": role, "content": h.get("content", "")})
        
        messages.append({"role": "user", "content": message})

        try:
            response = await client.chat.completions.create(
                model=preferred_model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )
            
            raw = (response.choices[0].message.content or "").strip()
            if not raw:
                return self._get_fallback_response("I seem to have lost my train of thought. Could you try again?")

            # 4. Extract suggestions
            reply, suggestions = self._extract_suggestions(raw)
            
            # 5. Intent detection
            memory_updated = False
            action_taken = None
            msg_lower = message.lower()

            # A. Bug report detection
            if "[ACTION: REPORT_BUG]" in raw:
                reply = reply.replace("[ACTION: REPORT_BUG]", "").strip()
                summary = message[:100]
                asyncio.create_task(self._report_to_admin(user_id, message, summary))
                action_taken = "Bug report logged"
                logger.info(f"[JARVIS] AI detected a bug report from user {user_id}")

            # B. Memory detection
            memory_keywords = ["i prefer", "i like", "i want", "my goal", "i'm looking for", "i am looking for", "i'm interested in"]
            if any(kw in msg_lower for kw in memory_keywords):
                try:
                    key = f"user_preference_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
                    await memory_service.create_memory(user_id, MemoryCreate(
                        category=JARVIS_MEMORY_CATEGORY,
                        key=key,
                        content=message,
                        metadata={"source": "jarvis_chat", "timestamp": datetime.now(timezone.utc).isoformat()}
                    ))
                    memory_updated = True
                except Exception as mem_err:
                    logger.error(f"[JARVIS] Memory storage failed: {mem_err}")

            # C. Switch Model Intent Detection
            if "[ACTION: SWITCH_MODEL|" in raw:
                try:
                    new_model = raw.split("[ACTION: SWITCH_MODEL|")[1].split("]")[0].strip()
                    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"preferred_ai_model": new_model}})
                    action_taken = f"Switched AI Model to {new_model}"
                    import re
                    reply = re.sub(r"\[ACTION: SWITCH_MODEL\|.*?\]", "", reply).strip()
                except Exception as e:
                    logger.error(f"[JARVIS] Model switch failed: {e}")

            return {
                "message": reply,
                "suggestions": suggestions,
                "memory_updated": memory_updated,
                "action_taken": action_taken
            }

        except Exception as e:
            logger.error(f"[JARVIS] Chat Critical Error: {e}", exc_info=True)
            return self._get_fallback_response("I apologize, but I am currently experiencing a connection delay.")

    @staticmethod
    def _extract_suggestions(raw: str) -> tuple:
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
        if not suggestions:
            suggestions = ["Check ATS Score", "How is my profile?", "Try Auto Pilot"]
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
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user: return "Unknown user"
        
        parts = [
            f"Name: {user.get('full_name', 'User')}",
            f"Skills: {user.get('skills', 'Not set')}",
            f"Location: {user.get('current_city', '')}, {user.get('state', '')}",
            f"Experience Summary: {user.get('experience', 'None')[:200]}..."
        ]
        
        try:
            cursor = db.ats_scans.find({"user_id": user_id}).sort("created_at", -1).limit(1)
            scans = await cursor.to_list(length=1)
            if scans:
                s = scans[0]
                parts.append(f"Latest ATS Scan: {s.get('overall_score', 'N/A')}/100 ({s.get('overall_grade', 'N/A')})")
        except Exception as e:
            logger.error(f"[JARVIS] ATS scan fetch error: {e}")

        mems = await memory_service.get_memories(user_id)
        if mems:
            insights = "\n".join([f"- {m.get('key')}: {m.get('content')}" for m in mems[:5]])
            parts.append(f"Recent Memories:\n{insights}")
            
        return "\n".join(parts)

    async def _get_app_stats(self, user_id: str) -> str:
        # Pull basic application counts instead of full session stats for speed
        db = get_database()
        count = await db.applications.count_documents({"user_id": user_id})
        return json.dumps({"total_applications": count})

    async def _report_to_admin(self, user_id: str, user_input: str, summary: str):
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        user_email = user.get("email", "Unknown")
        
        try:
            feedback_entry = {
                "user_id": user_id,
                "user_email": user_email,
                "user_name": user.get("full_name", "Anonymous"),
                "message": user_input,
                "summary": summary,
                "status": "new",
                "created_at": datetime.now(timezone.utc)
            }
            await db.feedbacks.insert_one(feedback_entry)
        except Exception as e:
            logger.error(f"Failed to persist feedback: {e}")

        subject = f"JARVIS Report: {summary[:50]}"
        body = f"<p><b>User:</b> {user_email}</p><p><b>Issue:</b> {user_input}</p>"
        
        try:
            await email_service.send_email(recipient_email=settings.ADMIN_EMAIL, subject=subject, html_content=body)
        except Exception as e:
            logger.error(f"JARVIS Failed to send report email: {e}")

jarvis_service = JarvisService()
