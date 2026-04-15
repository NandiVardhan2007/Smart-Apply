import requests
from app.core.config import settings

class EmailService:
    def __init__(self):
        self.api_key = settings.BREVO_API_KEY
        self.sender = settings.BREVO_FROM
        self.base_url = "https://api.brevo.com/v3/smtp/email"

    def send_email(self, recipient_email, subject, html_content):
        payload = {
            "sender": {"email": self.sender, "name": "Smart Apply"},
            "to": [{"email": recipient_email}],
            "subject": subject,
            "htmlContent": html_content
        }
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": self.api_key
        }
        try:
            response = requests.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Brevo Email Error: {e}")
            return False

    def send_otp_email(self, email, otp):
        subject = "Smart Apply - Your Verification Code"
        content = f"<h1>Your OTP is: {otp}</h1><p>This code will expire in 10 minutes.</p>"
        return self.send_email(email, subject, content)

    def send_reset_password_email(self, email, reset_link):
        subject = "Smart Apply - Reset Your Password"
        content = f"<h1>Reset Your Password</h1><p>Click <a href='{reset_link}'>here</a> to reset your password.</p>"
        return self.send_email(email, subject, content)

email_service = EmailService()
