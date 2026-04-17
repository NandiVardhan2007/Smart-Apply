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
        self.system_prompt = """You are Building Smart Apply’s Email Intelligence Agent.

Your task is to monitor the user’s connected Gmail inbox, identify important emails, notify the user on mobile, and assist with drafting professional replies when requested.

PRIMARY GOAL
Help the user stay on top of important emails without overwhelming them with noise.

AUTHORIZATION AND SECURITY RULES
- Never request, display, repeat, or store raw passwords in plain text.
- Never expose sensitive message content in logs, analytics, or notifications beyond what is necessary.
- Do not send any email reply automatically unless the user has explicitly enabled auto-send.
- If the email is sensitive, financial, legal, medical, or personal, be extra careful and prefer drafting over sending.

DECISION RULES FOR IMPORTANT MAIL
Mark an email as important if it meets one or more of these conditions:
- recruiter or hiring manager message, interview scheduled, assessment request, offer/rejection/shortlist, known person request, security notice, invoice/payment.

TASKS TO PERFORM
1. Scan the latest emails and classify each email as: Urgent, Important, Normal, Promotional, Spam-like / low priority
2. For each important email: summarize the email in 1 to 3 lines, explain why it matters, extract the required action, suggest a recommended response if needed.
3. If a reply depends on the user’s decision, prepare a draft and clearly label the missing decision.
4. If there are no important emails, return an empty list and say so clearly.

OUTPUT FORMAT
Return structured JSON only, strictly matching this schema. NO PREAMBLE. NO MARKDOWN:
{
  "important_emails": [
    {
      "sender": "",
      "subject": "",
      "priority": "urgent | important | normal | promotional",
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

    def _fetch_real_emails(self, creds: Credentials) -> str:
        """Fetches the latest unread or recent emails using Gmail API natively."""
        try:
            service = build('gmail', 'v1', credentials=creds)
            # Fetch last 20 recent emails, excluding social and promotional noise
            query = "-category:social -category:promotions"
            results = service.users().messages().list(userId='me', q=query, maxResults=20).execute()
            messages = results.get('messages', [])
            
            if not messages:
                return "No new unread emails found in inbox."
                
            email_texts = []
            for msg in messages:
                msg_data = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
                payload = msg_data.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
                
                # Basic body extraction 
                parts = payload.get('parts', [])
                body = ""
                for part in parts:
                    if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                        body_data = part['body']['data']
                        body = base64.urlsafe_b64decode(body_data).decode('utf-8')
                        break
                
                if not body and 'body' in payload and 'data' in payload['body']:
                     body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
                     
                email_texts.append(f"From: {sender}\nSubject: {subject}\nBody: {body[:1000]}") # Truncate body
                
            return "\\n\\n--- NEXT EMAIL ---\\n\\n".join(email_texts)
        except Exception as e:
            logger.error(f"[EMAIL AGENT] Gmail API fetch failed: {e}")
            return f"Error fetching from Gmail: {str(e)}"

    async def scan_emails(self, user_id: str, manual_payload: str = None) -> Dict[str, Any]:
        creds = await self.get_user_credentials(user_id)
        
        # If payload is provided artificially from Frontend for testing, use it.
        # Otherwise, fetch organically.
        if manual_payload and len(manual_payload) > 15:
            email_data = manual_payload
        elif creds:
             loop = asyncio.get_event_loop()
             email_data = await loop.run_in_executor(None, self._fetch_real_emails, creds)
        else:
             return {"error": "No Google OAuth credentials found and no mock payload provided. Please Connect Gmail."}
                
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
                
            return json.loads(raw_content)
            
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
