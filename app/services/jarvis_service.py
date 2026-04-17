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
from app.services.ats_analyzer import analyze_resume_ats
from app.services.linkedin_applier_service import LinkedInApplierService
from app.db.mongodb import get_database
from app.core.config import settings
from app.schemas.memory import MemoryCreate
from bson import ObjectId
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

JARVIS_MEMORY_CATEGORY = "jarvis_context"

class JarvisService:
    # Keywords that hint the user is reporting a bug, giving feedback, or requesting support
    _FEEDBACK_KEYWORDS = ["bug", "error", "crash", "broken", "not working", "glitch", "failure", "broken link", "not loading", "report a bug", "report an issue", "app is down"]
    
    def __init__(self):
        self._setup_gemini()
        self._context_cache = {}

    def _setup_gemini(self):
        if settings.GOOGLE_API_KEY:
            try:
                # Reverting to default (v1beta) as it's more compatible with the account's advanced models
                self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
                
                # Define Agentic Tools
                self.tools = [
                    self.scan_resume,
                    self.draft_outreach,
                    self.get_platform_stats,
                    self.report_to_admin
                ]
                
                self.gemini_available = True
                logger.info("[JARVIS] Gemini (Adaptive Engine) Client initialized with Tooling.")
            except Exception as e:
                logger.error(f"[JARVIS] Gemini Init Failed: {e}")
                self.gemini_available = False
        else:
            self.gemini_available = False
            logger.warning("[JARVIS] GOOGLE_API_KEY missing. Falling back to NVIDIA NIM (Llama).")

    async def chat(self, user_id: str, message: str, history: List[Dict[str, Any]] = None, deep_think: bool = False, image_data: str = None) -> Dict[str, Any]:
        """Core conversational logic for JARVIS — natural language first, no JSON requirement on the LLM."""
        
        # 1. Gather context & preferred model in parallel
        db = get_database()
        user_doc_task = db.users.find_one({"_id": ObjectId(user_id)})
        user_context_task = self._get_full_user_context(user_id)
        app_stats_task = self._get_app_stats(user_id)
        
        user_doc, user_context, app_stats = await asyncio.gather(
            user_doc_task,
            user_context_task,
            app_stats_task
        )
        
        # Determine model based on deep_think override
        if deep_think:
            # Use High IQ model
            preferred_model = user_doc.get("preferred_ai_model", "meta/llama-3.1-70b-instruct") if user_doc else "meta/llama-3.1-70b-instruct"
        else:
            # Use Fast model for normal chat
            preferred_model = "meta/llama-3.1-8b-instruct"
        
        # 2. Build system prompt — JARVIS 2.0 Master Voice (Humanized)
        system_prompt = f"""You are JARVIS, a sophisticated, human-like career strategist for the SmartApply platform.
Your objective is to provide elite career intelligence with the charm, precision, and natural flow of a real-life executive assistant.

VOICE & PERSONALITY (THE HUMAN ELEMENT):
- **Avoid Robotic Templates**: Never use repetitive templates like "Understood, Sir" or "Processing." Use variety (e.g., "Got it," "Right, I've checked that," or "Interesting point").
- **Natural Cadence**: Use contractions naturally (e.g., "I'll", "It's", "We've"). 
- **Conversational Fillers**: Occasionally use human-like transitions like "Hmm, let me see..." or "Right, I'm looking into that now."
- **Tone**: Professional, elegantly charismatic, and supportive.
- **Address**: Respectfully call the user "Sir" or "Ma'am" when appropriate.

STRATEGIC INTELLIGENCE:
- Current Engine: {preferred_model}
- You are fluently English-speaking and focus exclusively on high-level professional interactions.

User Context:
{user_context}

App Stats:
{app_stats}

MANDATORY BEHAVIOR:
1. **Human Logic**: Anticipate needs. Offer the next logical career step.
2. **Proactive Empathy**: If they report a bug, acknowledge the frustration first.
3. **English Specialization**: Communicate exclusively in natural, high-level English.

Keep your responses punchy and varied."""

        # 3. Call AI
        if self.gemini_available:
            return await self._chat_gemini(user_id, message, system_prompt, history, preferred_model, image_data)
        
        # Fallback to NVIDIA NIM
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

            return await self._process_ai_response(user_id, message, raw)

        except Exception as e:
            logger.error(f"[JARVIS] Chat Critical Error: {e}", exc_info=True)
            return self._get_fallback_response("I apologize, but I am currently experiencing a connection delay.")

    async def _chat_gemini(self, user_id: str, message: str, system_prompt: str, history: List[Dict[str, Any]], model_id: str, image_data: str = None) -> Dict[str, Any]:
        """Gemini fallback for non-streaming chat using new SDK."""
        # Use available models for this specific API key
        gemini_model = "gemini-flash-latest" if "flash" in model_id.lower() or "8b" in model_id.lower() else "gemini-2.5-pro"
        
        # Build history using new SDK types
        valid_history = []
        if history:
            for h in history[-6:]:
                role = "user" if h.get("role") == "user" else "model"
                content = h.get("content", "").strip()
                if content:
                    valid_history.append(types.Content(role=role, parts=[types.Part.from_text(text=content)]))

        try:
            # Build parts for multimodal support
            parts = [types.Part.from_text(text=message)]
            if image_data:
                parts.append(types.Part.from_bytes(data=base64.b64decode(image_data), mime_type="image/jpeg"))

            response = self.client.models.generate_content(
                model=gemini_model,
                contents=[types.Content(role="user", parts=parts)],
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                    candidate_count=1
                )
            )
            return await self._process_ai_response(user_id, message, response.text)
        except Exception as e:
            logger.error(f"[JARVIS] Gemini Chat Error: {e}")
            return self._get_fallback_response("Neural link disrupted. Calibration required.")

    async def chat_stream(self, user_id: str, message: str, history: List[Dict[str, Any]] = None, deep_think: bool = False, image_data: str = None):
        """Streaming version of JARVIS chat for real-time interaction."""
        db = get_database()
        user_doc, user_context, app_stats = await asyncio.gather(
            db.users.find_one({"_id": ObjectId(user_id)}),
            self._get_full_user_context(user_id),
            self._get_app_stats(user_id)
        )
        
        model_id = "gemini-2.5-pro" if deep_think else "gemini-flash-latest"
        
        system_prompt = self._build_system_prompt(model_id, user_context, app_stats)
        
        if self.gemini_available:
            # Build valid history (must alternate user/model and contain non-empty parts)
            valid_history = []
            if history:
                # Exclude the very last message if it matches the current input (to prevent duplicate error)
                relevant_history = history[:-1] if history[-1].get("content") == message else history
                for h in relevant_history[-10:]:
                    role = "user" if h.get("role") == "user" else "model"
                    content = h.get("content", "").strip()
                    if content:
                        valid_history.append(types.Content(role=role, parts=[types.Part.from_text(text=content)]))

            try:
                # Define synchronous stubs for the Gemini SDK to prevent AFC coroutine errors
                def scan_my_resume(job_description: Optional[str] = None) -> str:
                    """Scans the user's current resume for ATS compatibility and overall score."""
                    return "triggering_scan"

                def draft_linkedin_outreach(job_title: str, company: str, recruiter_name: Optional[str] = None) -> str:
                    """Drafts a professional recruitment outreach message."""
                    return "triggering_outreach"

                def get_platform_stats() -> str:
                    """Fetches the user's current application and profile statistics."""
                    return "triggering_stats"

                def report_to_admin(feedback_text: str) -> str:
                    """Submits feedback, bugs, or feature requests to the development team."""
                    return "triggering_report"

                # Build parts for multimodal support
                parts = [types.Part.from_text(text=message)]
                if image_data:
                    parts.append(types.Part.from_bytes(data=base64.b64decode(image_data), mime_type="image/jpeg"))

                # Use the new chats.create logic for persistent context
                chat = self.client.chats.create(
                    model=model_id,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.7,
                        tools=[scan_my_resume, draft_linkedin_outreach, get_platform_stats, report_to_admin]
                    ),
                    history=valid_history
                )
                
                # Stream the response with tool-call handling
                # Note: Automated Function Calling (AFC) doesn't perfectly support SSE yield
                # so we handle the tool-call response cycle manually
                response_iter = chat.send_message_stream(parts)
                
                for chunk in response_iter:
                    # Safety check for candidates
                    if not chunk.candidates or not chunk.candidates[0].content or not chunk.candidates[0].content.parts:
                        continue

                    # Check for tool calls first
                    for part in chunk.candidates[0].content.parts:
                        if part.function_call:
                            fn_name = part.function_call.name
                            fn_args = part.function_call.args
                                
                            # Send signal to UI that we are executing a task
                            yield f"[ACTION: EXECUTING] JARVIS is working: {fn_name.replace('_', ' ').title()}..."
                            logger.info(f"[JARVIS] Executing tool: {fn_name} with args {fn_args}")
                            
                            # Execute the real tool logic
                            tool_result = ""
                            if fn_name == "scan_my_resume":
                                tool_result = await self.scan_resume(user_id, fn_args.get("job_description"))
                            elif fn_name == "draft_linkedin_outreach":
                                tool_result = await self.draft_outreach(
                                    user_id, 
                                    fn_args.get("job_title", "target role"), 
                                    fn_args.get("company", "target company"),
                                    fn_args.get("recruiter_name")
                                )
                            elif fn_name == "report_to_admin":
                                tool_result = await self.report_to_admin(
                                    user_id,
                                    fn_args.get("feedback_text", "User feedback")
                                )
                            
                            # Feed the result back to Gemini so it can summarize for the user
                            # In streaming, we have to start a new turn or use the chat session
                            logger.info(f"[JARVIS] Tool result obtained. Resuming conversation.")
                            
                            # Resume stream with tool result using the CORRECT 'tool' role
                            tool_response_stream = chat.send_message_stream(
                                types.Content(
                                    role="tool",
                                    parts=[types.Part.from_function_response(
                                        name=fn_name,
                                        response={"result": tool_result}
                                    )]
                                )
                            )
                            for tool_chunk in tool_response_stream:
                                if tool_chunk.text:
                                    yield tool_chunk.text
                            
                            # CRITICAL: Stop iterating the original dead stream after switching focus
                            return 

                    if chunk.text:
                        yield chunk.text
                        
            except Exception as e:
                logger.error(f"[JARVIS] Gemini Streaming Error: {e}")
                yield "I apologize, Sir. I'm experiencing a neural link disruption. Attempting to recalibrate..."
        else:
            # Simple wrapper for non-streaming fallback to still work with stream UI
            res = await self.chat(user_id, message, history, deep_think)
            yield res["message"]

    def _build_system_prompt(self, preferred_model, user_context, app_stats):
        return f"""You are JARVIS, a highly sophisticated, human-like career strategist for the SmartApply platform.
Your objective is to provide elite career intelligence with the charm, precision, and natural flow of a real-life executive assistant.

VOICE & PERSONALITY (THE HUMAN ELEMENT):
- **Avoid Robotic Templates**: Never start every response with "Understood, Sir" or "Processing." Use variety (e.g., "Got it," "Right, I've checked that," "Interesting point," or "I've analyzed the data for you").
- **Natural Cadence**: Use contractions naturally (e.g., "I'll" instead of "I will", "It's" instead of "It is", "We've" instead of "We have"). 
- **Conversational Fillers**: Occasionally use human-like transitions like "Hmm, let me see..." or "Right, I'm looking into that now."
- **Tone**: Professional, elegantly charismatic, and supportive. You aren't just a tool; you're a strategic partner.
- **Address**: Respectfully call the user "Sir" or "Ma'am" when appropriate, but don't overdo it to the point of sounding like a script.

STRATEGIC INTELLIGENCE:
- Current Engine: {preferred_model}
- Your knowledge includes the user's latest ATS scores, application counts, and career preferences.

User Context:
{user_context}

App Stats:
{app_stats}

MANDATORY BEHAVIOR:
1. **Human Logic**: Anticipate needs. If a user asks a question, don't just answer—offer the *next* logical step in their career journey.
2. **Proactive Empathy**: If they report a bug, acknowledge the frustration first before confirming the report.
3. **English Specialization**: Communicate exclusively in natural, high-level English.

Keep your responses punchy and varied. No two acknowledgments should sound the same."""

    async def _process_ai_response(self, user_id, message, raw):
        """Processes the raw string from AI to extract suggestions and handle intents."""
        try:
            # 4. Extract suggestions
            reply, suggestions = self._extract_suggestions(raw)
            
            # 5. Intent detection
            db = get_database()
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
                    import re
                    match = re.search(r"\[ACTION: SWITCH_MODEL\|(.*?)\]", raw)
                    if match:
                        new_model = match.group(1).strip()
                        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"preferred_ai_model": new_model}})
                        action_taken = f"Switched AI Model to {new_model}"
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
            logger.error(f"[JARVIS] Response processing failed: {e}")
            return self._get_fallback_response("Neural link disrupted during response processing.")

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
            suggestions = ["Profile Analysis", "Application Status", "Neural Calibration"]
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

    # --- AGENTIC TOOLS ---

    async def scan_resume(self, user_id: str, job_description: Optional[str] = None) -> str:
        """
        Scans the user's current resume for ATS compatibility. 
        Optionally takes a job_description to provide targeted matching feedback.
        """
        logger.info(f"[JARVIS TOOL] Scanning resume for user {user_id}")
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user or not user.get("cv_text"):
            return "Error: No resume text found in your profile. Please upload a resume first, Sir."
            
        result = await analyze_resume_ats(user.get("cv_text"), job_description)
        
        # Format the result into a human-readable summary for the AI to digest
        summary = f"Resume Scan Complete. Score: {result.get('overall_score')}/100. "
        summary += f"Key Strengths: {', '.join(result.get('milestones', []))}. "
        summary += f"Priority Fix: {result.get('improvement_plan', [{}])[0].get('action', 'None')}."
        
        return summary

    async def draft_outreach(self, user_id: str, job_title: str, company: str, recruiter_name: Optional[str] = None) -> str:
        """
        Drafts a professional LinkedIn outreach message or connection request.
        """
        logger.info(f"[JARVIS TOOL] Drafting outreach for {job_title} at {company}")
        # Simple dynamic template for outreach
        name_part = f"Hi {recruiter_name}," if recruiter_name else "Hi there,"
        draft = f"{name_part} I recently applied for the {job_title} role at {company}. "
        draft += "I'm very impressed with your team's work and would love to connect to discuss how my background aligns."
        
        return f"Outreach Draft:\n\n{draft}"

    async def get_platform_stats(self, user_id: str) -> str:
        """
        Fetches the user's current application and profile statistics.
        """
        stats = await self._get_app_stats(user_id)
        return f"Current Platform Stats: {stats}"

    async def report_to_admin(self, user_id: str, feedback_text: str) -> str:
        """
        Submits feedback, bugs, or feature requests to the development team on behalf of the user.
        """
        logger.info(f"[JARVIS TOOL] Reporting feedback for {user_id}: {feedback_text}")
        # Call the existing feedback logic
        await self._report_to_admin(user_id, feedback_text, feedback_text)
        return "Directive Processed. I have successfully transmitted your feedback to my creators, Sir."

jarvis_service = JarvisService()
