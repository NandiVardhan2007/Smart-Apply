import logging
import httpx
import asyncio
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings
from app.services.email_templates import (
    get_welcome_email_html, 
    get_welcome_email_text,
    get_otp_email_html,
    get_otp_email_text
)

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.api_key = settings.BREVO_API_KEY
        self.sender = settings.BREVO_FROM
        self.base_url = "https://api.brevo.com/v3/smtp/email"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.RequestError)),
        reraise=True
    )
    async def send_email(self, recipient_email: str, subject: str, html_content: str, text_content: Optional[str] = None, attachments: Optional[list] = None):
        payload = {
            "sender": {"email": self.sender, "name": "Smart Apply"},
            "to": [{"email": recipient_email}],
            "subject": subject,
            "htmlContent": html_content
        }
        if text_content:
            payload["textContent"] = text_content
        
        if attachments:
            # Brevo expects format: [{"content": "base64", "name": "file.png"}]
            payload["attachment"] = attachments

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": self.api_key
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.base_url, json=payload, headers=headers)
                response.raise_for_status()
                logger.info(f"Email sent successfully to {recipient_email}")
                return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Brevo HTTP Error for {recipient_email}: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected Email Error for {recipient_email}: {str(e)}")
            raise

    async def send_otp_email(self, email: str, otp: str, purpose: str = "verification"):
        subject = f"Smart Apply - {'Your Verification Code' if purpose == 'verification' else 'Reset Your Password'}"
        html_content = get_otp_email_html(otp, purpose)
        text_content = get_otp_email_text(otp, purpose)
        try:
            return await self.send_email(email, subject, html_content, text_content)
        except Exception as e:
            logger.error(f"Failed to send OTP email to {email}: {str(e)}")
            return False

    async def send_reset_password_email(self, email: str, reset_link: str):
        subject = "Smart Apply - Reset Your Password"
        content = f"<h1>Reset Your Password</h1><p>Click <a href='{reset_link}'>here</a> to reset your password.</p>"
        try:
            return await self.send_email(email, subject, content)
        except Exception:
            return False

    async def send_welcome_email(self, email: str, full_name: Optional[str] = None):
        subject = "Welcome to Smart Apply! 🚀"
        html_content = get_welcome_email_html(full_name)
        text_content = get_welcome_email_text(full_name)
        
        try:
            logger.info(f"Triggering welcome email for {email}")
            return await self.send_email(email, subject, html_content, text_content)
        except Exception as e:
            logger.error(f"Failed to send welcome email to {email} after retries: {str(e)}")
            return False

email_service = EmailService()
