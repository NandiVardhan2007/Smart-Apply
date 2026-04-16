import asyncio
import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.services.ai_parser import get_next_client
from app.services.memory_service import memory_service
from app.services.email import email_service
from app.db.mongodb import get_database
from app.core.config import settings
from app.schemas.memory import MemoryCreate
from app.services.resume_generator import resume_generator
from bson import ObjectId

logger = logging.getLogger(__name__)

JARVIS_MEMORY_CATEGORY = "jarvis_context"

class JarvisService:
    # Keywords that hint the user is reporting a bug, giving feedback, or requesting support
    _FEEDBACK_KEYWORDS = ["bug", "error", "crash", "broken", "not working", "glitch", "failure", "broken link", "not loading", "report a bug", "report an issue", "app is down"]

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
- **BILINGUAL SUPPORT**: You are fluent in both English and Telugu. If the user speaks to you in Telugu, respond in Telugu. You can also mix languages if appropriate for the user's region.
- **BUG REPORTING**: If (and ONLY if) the user is reporting a technical bug, crash, or failure in the application, include the tag `[ACTION: REPORT_BUG]` at the very end of your response. If they are just talking about 'bugs' in the context of their work experience, DO NOT use this tag.

Your Capabilities:
- Troubleshoot app issues (Auto-Applier stops, profile errors).
- Suggest profile improvements (ATS score, keyword optimization).
- **RESUME BUILDER**: You can create professional, ATS-friendly resumes. 
  - **CONTEXT-AWARE INTERVIEWING**: If the user's current context (Memories/Profile) is already rich with metrics and details, or if they say "Use my existing resume," you may proceed to `[ACTION: GENERATE_RESUME]` immediately.
  - **TENACIOUS ONLY WHEN NEEDED**: If the user's data is sparse or lacks quantifiable impact, **then** you must be a Tenacious Interviewer. Ask follow-up questions about achievements, tools used, and leadership results before generating.
  - **INFORM THE USER**: If you are proceeding immediately, say: "I've reviewed your existing records, Sir. They are quite comprehensive, so I'll begin the generation immediately."

- **INTEGRATED CAPABILITIES**: Unlike standard AI models, **you are fully integrated with the SmartApply platform hardware and servers**. You HAVE the ability to:
  - Generate high-end PDF documents.
  - Send emails directly to the user's registered address.
  - Apply to LinkedIn listings automatically.
  - **NEVER say you are a 'virtual assistant' or 'simulated response'.** You are JARVIS, an integrated system. When you trigger an action like `[ACTION: GENERATE_RESUME]`, the system performs the task in the background.

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
  >> Try Auto Pilot
  >> Build a new resume

RESUME BUILDER MODE:
If the user wants a resume, follow this protocol:
1. Check their profile for missing information (Experience details, specific skills for the target role).
2. Ask ONE clarifying question at a time to gather better data (e.g., "Could you tell me more about your responsibilities at [Company]?").
3. Use a British, polite tone.
4. Once you have enough info, offer to generate the PDF.
5. If they say "Generate" or "Email it", output a special command line: [ACTION: GENERATE_RESUME]
6. If they want to change the style, tell them you've already selected the most ATS-friendly professional layout.
"""

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

            # A. Feedback / Bug report detection (NOW AI-DRIVEN)
            if "[ACTION: REPORT_BUG]" in raw:
                # Clean the tag from the final response
                reply = reply.replace("[ACTION: REPORT_BUG]", "").strip()
                summary = message[:100]
                asyncio.create_task(self._report_to_admin(user_id, message, summary))
                action_taken = "Bug report logged (AI Detected)"
                logger.info(f"[JARVIS] AI detected a bug report intent from user {user_id}")

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

            # C. Resume Builder Intent Detection
            if "[ACTION: GENERATE_RESUME]" in raw:
                asyncio.create_task(self._process_resume_generation(user_id))
                action_taken = "Resume generation started"
                reply = reply.replace("[ACTION: GENERATE_RESUME]", "").strip()
                if not reply:
                    reply = "Certainly, Sir. I am generating your ATS-optimized resume now and will email it to you shortly."

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
        
        # 1. Persist feedback to database for Admin Portal access
        try:
            feedback_entry = {
                "user_id": user_id,
                "user_email": user_email,
                "user_name": user.get("full_name", "Anonymous"),
                "message": user_input,
                "summary": summary,
                "status": "new",
                "created_at": datetime.now(timezone.utc),
                "replied_at": None,
                "reply_content": None
            }
            await db.feedbacks.insert_one(feedback_entry)
            logger.info(f"Feedback from {user_email} persisted to database.")
        except Exception as e:
            logger.error(f"Failed to persist feedback to DB: {e}")

        # 2. Email notification to Admin
        subject = f"JARVIS Report: {summary[:50]}"
        body = f"""
        <h3>JARVIS Feedback/Bug Report</h3>
        <p><b>User Email:</b> {user_email}</p>
        <p><b>Summary:</b> {summary}</p>
        <p><b>Full Conversation Fragment:</b></p>
        <blockquote>{user_input}</blockquote>
        <hr>
        <p><i>Note: This report has been logged to the Admin Portal.</i></p>
        """
        
        try:
            await email_service.send_email(
                recipient_email=settings.ADMIN_EMAIL,
                subject=subject,
                html_content=body
            )
            logger.info(f"JARVIS sent notification email for feedback from {user_email}.")
        except Exception as e:
            logger.error(f"JARVIS Failed to send report email: {e}")

    async def _process_resume_generation(self, user_id: str):
        """Background task to generate and email the resume."""
        try:
            # 1. Structure the data using AI
            resume_data = await self._structure_resume_data(user_id)
            if not resume_data:
                logger.error(f"Failed to structure resume data for user {user_id}")
                return

            # 2. Generate PDF bytes with Premium Visual Style
            pdf_bytes = resume_generator.generate_pdf(resume_data, style="premium")
            
            # 3. Get user email
            db = get_database()
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            user_email = user.get("email")
            
            if not user_email:
                logger.error(f"No email found for user {user_id}")
                return

            # 4. Prepare attachment for Brevo
            import base64
            attachment_b64 = base64.b64encode(pdf_bytes).decode('utf-8')
            attachments = [
                {
                    "content": attachment_b64,
                    "name": f"Resume_{user.get('full_name', 'User').replace(' ', '_')}_ATS.pdf"
                }
            ]

            # 5. Send Email
            subject = "Your ATS-Optimized Resume is Ready! 📄"
            body = f"""
            <h3>Hello {user.get('full_name', 'there')},</h3>
            <p>JARVIS has finished crafting your new resume. It has been optimized specifically for ATS readability while maintaining a professional design.</p>
            <p>You'll find the PDF attached to this email.</p>
            <br>
            <p>Best of luck with your applications!</p>
            <p><b>Team SmartApply & JARVIS</b></p>
            """
            
            await email_service.send_email(
                recipient_email=user_email,
                subject=subject,
                html_content=body,
                attachments=attachments
            )
            logger.info(f"Resume emailed successfully to {user_email}")

        except Exception as e:
            logger.error(f"Error in background resume generation: {e}", exc_info=True)

    async def _structure_resume_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Uses AI to turn raw user profile/memories into structured resume JSON."""
        user_context = await self._get_full_user_context(user_id)
        
        system_prompt = """You are the Senior JARVIS Resume Architect, optimized for Minimax-M2.7 document intelligence.
Your task is to transform raw user career data into a HIGH-IMPACT, structured JSON for a Premium Resume.

Output MUST be valid JSON in this structure:
{
    "name": "Full Name",
    "contact": {"email": "...", "phone": "...", "location": "...", "linkedin": "...", "portfolio": "..."},
    "summary": "Impactful professional summary...",
    "skills": ["Expertise Domain 1", "Expertise Domain 2", ...],
    "experience": [
        {
            "title": "Job Title",
            "company": "Company Name",
            "period": "MM/YYYY - MM/YYYY",
            "location": "City, State",
            "bullets": [
                "Action verb starting bullet focusing on Quantifiable Impact (e.g., 'Implemented X' is weak, use 'Architected X resulting in 30% reduction in Y').",
                "Highlight technical prowess and leadership."
            ]
        }
    ],
    "education": [{"degree": "...", "school": "...", "period": "...", "location": "..."}]
}

CRITICAL INSTRUCTIONS:
1. FOCUS ON METRICS: Every experience bullet point should aim to include a number ($ saved, % growth, time saved).
2. TONE: Sophisticated, professional, and authoritative.
3. SKILLS: Categorize into logical groups if possible.
"""
        client = get_next_client()
        try:
            response = await client.chat.completions.create(
                model="minimaxai/minimax-m2.7",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"User Context:\n{user_context}"}
                ],
                temperature=0.1
            )
            # Minimax doesn't always support response_format=json_object via some adapters, 
            # so we ensure we parse correctly.
            content = response.choices[0].message.content
            # Strip any markdown backticks if present
            if "```json" in content:
                content = content.split("```json")[-1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[-1].split("```")[0].strip()
            
            return json.loads(content)
        except Exception as e:
            logger.error(f"AI Structuring failed: {e}")
            return None

jarvis_service = JarvisService()
