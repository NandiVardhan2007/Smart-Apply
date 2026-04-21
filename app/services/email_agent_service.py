import logging
import json
import base64
from typing import List, Dict, Any, Optional
from datetime import timezone, datetime
from bson import ObjectId
import asyncio

from app.db.mongodb import get_database
from app.services.ai_parser import MODELS, call_nvidia
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
      "notification_text": "",
      "thread_id": "The thread ID from the source data"
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
            
            # IDENTITY CHECK
            try:
                profile = service.users().getProfile(userId='me').execute()
                logger.info(f"[EMAIL AGENT] Connected to {profile.get('emailAddress')}")
            except Exception as profile_err:
                logger.warning(f"[EMAIL AGENT] Profile fetch failed: {profile_err}")

            # Remove ALL filters to ensure we see the test email
            query = ""
            results = service.users().messages().list(userId='me', q=query, maxResults=50).execute()
            messages = results.get('messages', [])
            
            if not messages:
                return {"ai_data": "No emails found.", "recent_emails": []}
                
            email_texts = []
            recent_emails = []
            for msg in messages:
                msg_data = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
                payload = msg_data.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
                
                recent_emails.append({
                    "id": msg['id'],
                    "threadId": msg.get('threadId'),
                    "subject": subject,
                    "sender": sender,
                    "snippet": msg_data.get('snippet', ''),
                    "date": next((h['value'] for h in headers if h['name'] == 'Date'), '')
                })

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
                email_texts.append(f"THREAD ID: {msg.get('threadId')}\nFrom: {sender}\nSubject: {subject}\nBody: {body[:1500]}")
                
            return {
                "ai_data": "\n\n--- NEXT EMAIL ---\n\n".join(email_texts),
                "recent_emails": recent_emails
            }
        except Exception as e:
            logger.error(f"[EMAIL AGENT] Gmail API fetch failed: {e}")
            return {"ai_data": f"Error: {e}", "recent_emails": []}

    async def scan_emails(self, user_id: str, manual_payload: str = None) -> Dict[str, Any]:
        creds = await self.get_user_credentials(user_id)
        
        recent_emails = []
        if manual_payload and len(manual_payload) > 15:
            email_data = manual_payload
        elif creds:
             loop = asyncio.get_running_loop()
             result = await loop.run_in_executor(None, self._fetch_real_emails, creds)
             email_data = result["ai_data"]
             recent_emails = result["recent_emails"]
        else:
             return {"error": "No Google OAuth credentials found. Please Connect Gmail."}
                
        try:
            raw_content = await call_nvidia(
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"INPUT MAILBOX DATA:\n{email_data}\n\nNOW ANALYZE THE CONNECTED MAILBOX AND RESPOND ACCORDINGLY. RETURN PURE JSON."}
                ],
                model=MODELS["quality"], # Email summarization needs quality
                temperature=0.1,
                max_tokens=2000
            )
            
            # Clean up markdown code blocks to coerce strictly into JSON
            if "```json" in raw_content:
                raw_content = raw_content.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_content:
                raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
            result = json.loads(raw_content)
            result["recent_emails"] = recent_emails
            result["version"] = "v1.3-Hybrid-Inbox"
            return result
            
        except Exception as e:
            logger.error(f"[EMAIL AGENT] AI Parsing Error: {e}")
            return {"error": f"AI Parsing Error: {str(e)}"}

    async def generate_draft_reply(self, user_id: str, thread_context: str, user_instruction: str) -> Dict[str, Any]:
        input_data = f"THREAD CONTEXT: {thread_context}\nUSER INSTRUCTION: {user_instruction}\n\nDraft a reply adhering to the Agent Rules. Return PURE JSON."
        try:
            raw_content = await call_nvidia(
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": input_data}
                ],
                model=MODELS["fast"], # Quick reply generation
                temperature=0.2,
                max_tokens=800
            )
            if "```json" in raw_content:
                raw_content = raw_content.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_content:
                raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
            return json.loads(raw_content)
        except Exception as e:
             return {"error": str(e)}

    def _send_real_reply(self, creds: Credentials, thread_id: str, reply_body: str, subject: str) -> Dict[str, Any]:
        """Sends a reply to a thread via Gmail API."""
        try:
            service = build('gmail', 'v1', credentials=creds)
            
            # 1. Fetch the thread to get the latest message details (for headers)
            thread = service.users().threads().get(userId='me', id=thread_id).execute()
            messages = thread.get('messages', [])
            if not messages:
                return {"error": "Thread not found or empty."}
            
            last_msg = messages[-1]
            headers = last_msg.get('payload', {}).get('headers', [])
            
            # Get necessary headers for a proper reply
            msg_id = next((h['value'] for h in headers if h['name'].lower() == 'message-id'), None)
            orig_subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
            
            final_subject = subject or orig_subject
            if not final_subject.lower().startswith('re:'):
                final_subject = f"Re: {final_subject}"
            
            # Determine "To" (usually the sender of the last message)
            reply_to = next((h['value'] for h in headers if h['name'].lower() == 'from'), None)
            
            # Construct the email
            from email.mime.text import MIMEText
            message = MIMEText(reply_body)
            message['to'] = reply_to
            message['subject'] = final_subject
            if msg_id:
                message['In-Reply-To'] = msg_id
                message['References'] = msg_id

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
            
            # Send as a reply to the thread
            sent_message = service.users().messages().send(
                userId='me',
                body={'raw': raw, 'threadId': thread_id}
            ).execute()
            
            return {"success": True, "message_id": sent_message['id'], "thread_id": sent_message['threadId']}
            
        except Exception as e:
            logger.error(f"[EMAIL AGENT] Gmail API send failed: {e}")
            return {"error": str(e)}

    async def send_reply(self, user_id: str, thread_id: str, reply_body: str, subject: str = None) -> Dict[str, Any]:
        creds = await self.get_user_credentials(user_id)
        if not creds:
            return {"error": "No Google OAuth credentials found."}
            
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._send_real_reply, creds, thread_id, reply_body, subject)

email_agent_service = EmailAgentService()
