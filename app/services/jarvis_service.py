import asyncio
import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.services.ai_parser import get_next_client
from app.services.memory_service import memory_service
from app.services.email import email_service
from app.db.mongodb import get_database
from app.utils.json_repair import robust_json_loads
from app.schemas.memory import MemoryCreate

logger = logging.getLogger(__name__)

JARVIS_MEMORY_CATEGORY = "jarvis_context"
ADMIN_EMAIL = "kovvurinandivardhanreddy2007@gmail.com"

class JarvisService:
    async def chat(self, user_id: str, message: str, history: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Core conversational logic for JARVIS."""
        
        # 1. Gather context
        user_context = await self._get_full_user_context(user_id)
        app_stats = await self._get_app_stats(user_id)
        
        # 2. Build system prompt
        system_prompt = f"""You are JARVIS, an advanced AI assistant for the SmartApply platform.
SmartApply helps users automate job applications on LinkedIn and optimize their profiles.

Your Personality:
- Professional, intelligent, yet approachable and friendly.
- Like a companion who truly wants the user to succeed.
- Never robotic. Use a natural conversational flow.

Your Capabilities:
- Troubleshoot app issues (Auto-Applier stops, profile errors).
- Suggest profile improvements (ATS score, keyword optimization).
- Store important user preferences in "memory".
- Report bugs or suggestions to the admin.

Safety & Accuracy:
- Only provide advice related to career, job applications, and the SmartApply platform.
- Do NOT provide medical, legal, or financial advice.
- If unsure about a user query, ask clarifying questions instead of guessing.
- Ground all responses in actual user data and app state.

User Context:
{user_context}

App Stats:
{app_stats}

STRICT INSTRUCTIONS:
1. Ground your answers in the user's data.
2. If the user suggests an improvement or reports a BUG, acknowledge it and say you'll inform the developer. Then, trigger the "report" intent.
3. If you detect a new insight about the user (e.g., they prefer remote work), trigger the "memory" intent.
4. Return ONLY valid JSON. NO markdown. NO preamble.
Structure:
{{
  "response": "Your conversational reply here",
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "intents": {{
    "report_feedback": "Short description if feedback/bug detected, else null",
    "track_memory": {{ "key": "insight_key", "content": "insight_content" }} // null if no new insight
  }}
}}"""

        # 3. Call AI
        client = get_next_client()
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add limited history with role mapping safety
        if history:
            for h in history[-6:]:
                role = h.get("role", "user")
                # Map 'jarvis' or any non-standard role to 'assistant' for LLM compatibility
                if role.lower() not in ["user", "system", "assistant", "developer"]:
                    role = "assistant"
                messages.append({"role": role, "content": h.get("content", "")})
        
        messages.append({"role": "user", "content": message})

        try:
            response = await client.chat.completions.create(
                model="meta/llama-3.1-8b-instruct",
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )
            
            raw = response.choices[0].message.content
            parsed = await asyncio.to_thread(robust_json_loads, raw)
            
            if not parsed:
                logger.warning(f"[JARVIS] Parsing failed for raw content: {raw[:200]}...")
                return self._get_fallback_response("I encountered a formatting issue while thinking. Could you please rephrase?")

            reply = parsed.get("response", "I'm sorry, I'm having trouble processing that.")
            suggestions = parsed.get("suggestions", [])
            intents = parsed.get("intents", {})
            
            # 4. Handle Intents
            # A. Update Memory
            memory_updated = False
            if intents and intents.get("track_memory"):
                m = intents["track_memory"]
                if m.get("key") and m.get("content"):
                    await memory_service.create_memory(user_id, MemoryCreate(
                        category=JARVIS_MEMORY_CATEGORY,
                        key=m["key"],
                        content=m["content"],
                        metadata={"source": "jarvis_chat", "timestamp": datetime.now(timezone.utc).isoformat()}
                    ))
                    memory_updated = True
            
            # B. Report Feedback
            if intents and intents.get("report_feedback"):
                await self._report_to_admin(user_id, message, intents["report_feedback"])

            return {
                "message": reply,
                "suggestions": suggestions,
                "memory_updated": memory_updated,
                "action_taken": "Feedback reported to admin" if intents and intents.get("report_feedback") else None
            }

        except Exception as e:
            logger.error(f"[JARVIS] Chat Critical Error: {e}", exc_info=True)
            return self._get_fallback_response("I apologize, but I am currently experiencing a connection delay. Please try again in a moment.")

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
