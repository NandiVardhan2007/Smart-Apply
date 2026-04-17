import logging
import json
import base64
from typing import List, Dict, Any, Optional
from datetime import timezone, datetime
from bson import ObjectId
import asyncio

from app.db.mongodb import get_database
from app.services.ai_parser import get_next_client
from app.core.security import decrypt_token
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

class EmailAgentService:
    def __init__(self):
        # Enforcing exactly the requested behavior through strict LLaMA coercion
        self.system_prompt = """You are Smart Apply’s Email Intelligence Agent.
Your job is to identify and summarize emails related to job applications, recruitment, and career opportunities.

CRITICAL INSTRUCTIONS:
1. ALWAYS mark an email as IMPORTANT if it contains keywords: "Interview", "Application", "Developer", "Systems", "Role", "Recruiter", "Assessment", "Offer", "Meeting", "Screening".
2. Even if the email is READ, treat it as important if it's about a job application.
3. Be helpful, professional, and concise.

DECISION RULES:
- IMPORTANT: Recruiter outreach, interview invites, tech assessments, job offers, or replies to applications.
- NORMAL: General newsletters, login notices, personal emails.
- PROMOTIONAL: Ads, marketing, spam.

OUTPUT FORMAT:
Return structured JSON only. NO MARKDOWN:
{
  "important_emails": [
    {
      "sender": "",
      "subject": "",
      "priority": "urgent | important | normal",
      "summary": "",
      "why_it_matters": "",
      "recommended_action": "",
      "notification_text": ""
    }
  ],
  "reply_needed": true,
  "draft_reply": {
    "subject": "",
    "body": "",
    "confidence": "high | medium | low"
  },
  "notes_for_user": ""
}"""

    async def get_user_credentials(self, user_id: str) -> Optional[Credentials]:
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or "google_credentials" not in user:
            return None
            
        creds_data = user["google_credentials"]
        return Credentials(
            token=decrypt_token(creds_data.get("token")),
            refresh_token=decrypt_token(creds_data.get("refresh_token")),
            token_uri=creds_data.get("token_uri"),
            client_id=creds_data.get("client_id"),
            client_secret=creds_data.get("client_secret"),
            scopes=creds_data.get("scopes")
        )

    def _fetch_real_emails(self, creds: Credentials) -> Dict[str, Any]:
        """Fetches the latest emails using Gmail API natively."""
        try:
            service = build('gmail', 'v1', credentials=creds)
            # Remove ALL filters to ensure we see the test email
            query = ""
            print(f"[DEBUG] Fetching emails for query: '{query}'")
            results = service.users().messages().list(userId='me', q=query, maxResults=20).execute()
            messages = results.get('messages', [])
            
            if not messages:
                print("[DEBUG] No messages found at all in Gmail.")
                return {"ai_data": "No emails found.", "subjects": []}
                
            print(f"[DEBUG] Found {len(messages)} messages. Processing...")
            email_texts = []
            subjects = []
            for msg in messages:
                msg_data = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
                payload = msg_data.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
                print(f"[DEBUG] Processing Subject: {subject}")
                subjects.append(subject)

                # Robust body extraction covering nested parts
                def get_body(payload_data):
                    if 'data' in payload_data.get('body', {}):
                        return base64.urlsafe_b64decode(payload_data['body']['data']).decode('utf-8')
                    
                    parts = payload_data.get('parts', [])
                    for p in parts:
                        if p['mimeType'] == 'text/plain':
                            return get_body(p)
                    # Fallback to HTML if plain text not found
                    for p in parts:
                        if p['mimeType'] == 'text/html':
                            # Basic HTML to text conversion (removing tags)
                            html = get_body(p)
                            import re
                            return re.sub('<[^<]+?>', '', html)
                        if 'parts' in p:
                            res = get_body(p)
                            if res: return res
                    return ""

                body = get_body(payload)
                email_texts.append(f"From: {sender}\nSubject: {subject}\nBody: {body[:1500]}")
                
            return {
                "ai_data": "\n\n--- NEXT EMAIL ---\n\n".join(email_texts),
                "subjects": subjects
            }
        except Exception as e:
            logger.error(f"[EMAIL AGENT] Gmail API fetch failed: {e}")
            return {"ai_data": f"Error: {e}", "subjects": []}

    async def scan_emails(self, user_id: str, manual_payload: str = None) -> Dict[str, Any]:
        creds = await self.get_user_credentials(user_id)
        
        fetched_subjects = []
        if manual_payload and len(manual_payload) > 15:
            email_data = manual_payload
        elif creds:
             loop = asyncio.get_event_loop()
             result = await loop.run_in_executor(None, self._fetch_real_emails, creds)
             email_data = result["ai_data"]
             fetched_subjects = result["subjects"]
        else:
             return {"error": "No Google OAuth credentials found. Please Connect Gmail."}
                
        try:
            client = get_next_client()
            response = await client.chat.completions.create(
                model="meta/llama-3.1-70b-instruct",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"INPUT MAILBOX DATA:\\n{email_data}\\n\\nNOW ANALYZE THE CONNECTED MAILBOX AND RESPOND ACCORDINGLY. RETURN PURE JSON."}
                ],
                temperature=0.1,
                max_tokens=2000
            )
            raw_content = response.choices[0].message.content
            
            # Clean up markdown code blocks to coerce strictly into JSON
            if "```json" in raw_content:
                raw_content = raw_content.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_content:
                raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
            result = json.loads(raw_content)
            result["fetched_subjects"] = fetched_subjects
            result["version"] = "v1.2-Subjects-Fix"
            return result
            
        except Exception as e:
            logger.error(f"[EMAIL AGENT] AI Parsing Error: {e}")
            return {"error": f"AI Parsing Error: {str(e)}"}

    async def generate_draft_reply(self, user_id: str, thread_context: str, user_instruction: str) -> Dict[str, Any]:
        client = get_next_client()
        input_data = f"THREAD CONTEXT: {thread_context}\\nUSER INSTRUCTION: {user_instruction}\\n\\nDraft a reply adhering to the Agent Rules. Return PURE JSON."
        
        try:
            response = await client.chat.completions.create(
                model="meta/llama-3.1-70b-instruct",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": input_data}
                ],
                temperature=0.2,
                max_tokens=800
            )
            raw_content = response.choices[0].message.content
            if "```json" in raw_content:
                raw_content = raw_content.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_content:
                raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
            return json.loads(raw_content)
        except Exception as e:
             return {"error": str(e)}

email_agent_service = EmailAgentService()
