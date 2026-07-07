import random
import string
from datetime import datetime, timedelta, timezone

import httpx
import logging
import urllib.parse

from app.config import settings

# ---------------------------------------------------------------------------
# Neo-Brutalist Email Styling
# ---------------------------------------------------------------------------
def _email_header() -> str:
    logo_url = "https://pub-a29a8801cf434d20a5dc0b4891eaa828.r2.dev/Logo/logo.svg"
    return f"""
    <div style="text-align: center; margin-bottom: 32px;">
        <img src="{logo_url}" alt="SMART APPLY" width="180" style="display: block; margin: 0 auto; width: 180px; height: auto;" />
    </div>
    """

def _email_wrapper(body_html: str) -> str:
    return f"""
    <div style="background-color: #030305; padding: 40px 0; width: 100%;">
        <div style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                    max-width: 600px; margin: 0 auto; padding: 0 24px;
                    color: #ffffff;">
            {_email_header()}
            {body_html}
            <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #1a1a24; text-align: center;">
                <p style="color: #64748b; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
                    &copy; {datetime.now().year} SMART APPLY. ALL RIGHTS RESERVED.
                </p>
            </div>
        </div>
    </div>
    """


import secrets

def generate_otp(length: int = 6) -> str:
    """Generate a secure random numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def get_otp_expiry(minutes: int = 10) -> datetime:
    """Return a UTC datetime for OTP expiration."""
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


async def _brevo_send(to_email: str, subject: str, html_content: str) -> bool:
    """Low-level Brevo send helper."""
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": settings.BREVO_API_KEY,
    }
    payload = {
        "sender": {
            "name": settings.BREVO_SENDER_NAME,
            "email": settings.BREVO_SENDER_EMAIL,
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content,
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            return response.status_code in (200, 201)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# OTP email
# ---------------------------------------------------------------------------
async def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send an OTP verification email via Brevo."""
    body = f"""
    <div style="background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 40px 32px; text-align: center; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #38bdf8; letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 24px 0;">
            Verification Code
        </h2>
        <div style="background: #15151a; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #1a1a24; display: inline-block; font-size: 42px; font-family: 'JetBrains Mono', monospace; font-weight: 700; letter-spacing: 12px;">
            {otp_code}
        </div>
        <p style="margin: 24px 0 0 0; font-size: 14px; font-weight: 500; color: #f87171;">
            Expires in 10 minutes. Do not share.
        </p>
    </div>
    """
    html = _email_wrapper(body)
    return await _brevo_send(
        to_email,
        f"VERIFICATION CODE: {otp_code}",
        html,
    )


# ---------------------------------------------------------------------------
# Interview report email
# ---------------------------------------------------------------------------
async def send_interview_report_email(to_email: str, report_data: dict) -> bool:
    """Send an interview report summary email via Brevo."""
    score = report_data.get("final_score", "N/A")
    feedback = report_data.get("overall_feedback", "")
    room_name = report_data.get("room_name", "")
    encoded_room_name = urllib.parse.quote(room_name)
    report_url = f"{settings.FRONTEND_URL}/dashboard/live-interview/report/{encoded_room_name}"

    areas_html = "".join(
        f"<li style='margin-bottom:12px;'>{item}</li>"
        for item in report_data.get("areas_for_improvement", [])
    )
    weaknesses_html = "".join(
        f"<li style='margin-bottom:12px;'>{item}</li>"
        for item in report_data.get("weaknesses", [])
    )
    telemetry = report_data.get("telemetry_summary", {})
    avg_conf = round(telemetry.get("avg_confidence", 0) * 100)
    blinks = telemetry.get("blink_count", 0)
    comm_feedback = report_data.get("communication_feedback", "No grammatical issues found.")

    body = f"""
    <div style="background: #0a0a0d; border: 1px solid #38bdf8; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px; box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);">
        <h2 style="font-size: 22px; font-weight: 700; margin: 0; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.05em;">
            AI Interview Assessment Ready
        </h2>
    </div>

    <!-- Score card -->
    <div style="background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; color: #94a3b8;">FINAL SCORE</div>
        <div style="font-size: 64px; font-weight: 800; color: #ffffff; line-height: 1;">
            <span style="color: #38bdf8;">{score}</span><span style="font-size: 32px; color: #64748b;">/100</span>
        </div>
    </div>

    <!-- Telemetry row -->
    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
        <div style="flex: 1; background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 20px; text-align: center;">
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; color: #94a3b8;">CONFIDENCE</div>
            <div style="font-size: 28px; font-weight: 700; color: #34d399;">{avg_conf}%</div>
        </div>
        <div style="flex: 1; background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 20px; text-align: center;">
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; color: #94a3b8;">EYE BLINKS</div>
            <div style="font-size: 28px; font-weight: 700; color: #fbbf24;">{blinks}</div>
        </div>
    </div>

    <!-- Overall feedback -->
    <div style="background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 16px 0; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.05em;">OVERALL FEEDBACK</h3>
        <p style="font-size: 15px; line-height: 1.6; margin: 0; color: #e2e8f0;">{feedback}</p>
    </div>

    <!-- Communication & Grammar -->
    <div style="background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 16px 0; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.05em;">GRAMMAR & COMM.</h3>
        <p style="font-size: 15px; line-height: 1.6; margin: 0; color: #e2e8f0;">{comm_feedback}</p>
    </div>

    <!-- Areas for improvement -->
    <div style="background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 24px; margin-bottom: 32px;">
        <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 16px 0; text-transform: uppercase; color: #f87171; letter-spacing: 0.05em;">IMPROVE ON</h3>
        <ul style="font-size: 15px; padding-left: 20px; margin: 0; color: #e2e8f0; line-height: 1.6;">
            {areas_html}
        </ul>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin-top: 40px;">
        <a href="{report_url}"
           style="display: inline-block; padding: 14px 32px; background: #38bdf8; color: #030305; border-radius: 30px; text-decoration: none; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            VIEW FULL REPORT
        </a>
    </div>
    """
    html = _email_wrapper(body)
    return await _brevo_send(
        to_email,
        "SMART APPLY: AI INTERVIEW ASSESSMENT",
        html,
    )


# ---------------------------------------------------------------------------
# Tailored resume email  (PDF attachment via Brevo)
# ---------------------------------------------------------------------------
async def send_tailored_resume_email(
    to_email: str,
    pdf_bytes: bytes,
    filename: str = "tailored_resume.pdf",
) -> bool:
    """Send the tailored PDF resume as an email attachment via Brevo."""
    import base64

    body = """
    <div style="background: #0a0a0d; border: 1px solid #38bdf8; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px; box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);">
        <h2 style="font-size: 22px; font-weight: 700; margin: 0; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.05em;">
            Your Tailored Resume is Ready
        </h2>
    </div>

    <div style="background: #0a0a0d; border: 1px solid #1a1a24; border-radius: 16px; padding: 32px; margin-bottom: 24px;">
        <p style="font-size: 16px; font-weight: 500; line-height: 1.7; color: #e2e8f0; margin: 0 0 20px 0;">
            Our AI has successfully tailored your resume based on the job description
            and recommendations you provided. Your customised PDF is attached to this email.
        </p>
        <p style="font-size: 15px; font-weight: 400; color: #94a3b8; margin: 0; line-height: 1.6;">
            Open the attached <strong>PDF</strong> and review the changes.
            Head back to Smart Apply to make further edits anytime.
        </p>
    </div>

    <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
        <p style="font-size: 13px; font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
            TIP: Paste this resume into your job application portal for the best ATS results.
        </p>
    </div>
    """

    html = _email_wrapper(body)

    # Encode PDF as base64 for Brevo attachment
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": settings.BREVO_API_KEY,
    }
    payload = {
        "sender": {
            "name": settings.BREVO_SENDER_NAME,
            "email": settings.BREVO_SENDER_EMAIL,
        },
        "to": [{"email": to_email}],
        "subject": "SMART APPLY: Your Tailored Resume Is Ready 🎯",
        "htmlContent": html,
        "attachment": [
            {
                "content": pdf_b64,
                "name": filename,
            }
        ],
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            return response.status_code in (200, 201)
    except Exception as exc:
        logging.getLogger(__name__).error("Failed to send tailored resume email: %s", exc)
        return False
