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
        <div style="display: inline-block; background: #fff; border: 4px solid #000; padding: 12px; box-shadow: 6px 6px 0px #000; transform: rotate(-2deg);">
            <img src="{logo_url}" alt="SMART APPLY" width="160" style="display: block; width: 160px; height: auto;" />
        </div>
    </div>
    """

def _email_wrapper(body_html: str) -> str:
    return f"""
    <div style="font-family: 'Courier New', Courier, monospace; max-width: 600px;
                margin: 0 auto; padding: 40px 24px;
                background: #F4F4F0; color: #000;">
        {_email_header()}
        {body_html}
        <div style="margin-top: 48px; padding-top: 24px; border-top: 4px solid #000; text-align: center;">
            <p style="color: #000; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                &copy; 2026 SMART APPLY. ALL RIGHTS RESERVED.
            </p>
        </div>
    </div>
    """


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


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
    <div style="background: #FFF; border: 4px solid #000; padding: 32px; box-shadow: 8px 8px 0px #000; text-align: center; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0 0 24px 0;">
            YOUR VERIFICATION CODE
        </h2>
        <div style="background: #000; color: #FFF; padding: 20px; border: 4px solid #000; display: inline-block; font-size: 48px; font-weight: 900; letter-spacing: 16px;">
            {otp_code}
        </div>
    </div>
    <div style="background: #FF6B6B; border: 4px solid #000; padding: 16px; box-shadow: 4px 4px 0px #000; text-align: center;">
        <p style="margin: 0; font-size: 14px; font-weight: bold; color: #000; text-transform: uppercase;">
            EXPIRES IN 10 MINUTES. DO NOT SHARE.
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
        f"<li style='margin-bottom:8px; border-bottom: 2px solid #000; padding-bottom: 4px;'>{item}</li>"
        for item in report_data.get("areas_for_improvement", [])
    )
    weaknesses_html = "".join(
        f"<li style='margin-bottom:8px; border-bottom: 2px solid #000; padding-bottom: 4px;'>{item}</li>"
        for item in report_data.get("weaknesses", [])
    )
    telemetry = report_data.get("telemetry_summary", {})
    avg_conf = round(telemetry.get("avg_confidence", 0) * 100)
    blinks = telemetry.get("blink_count", 0)
    comm_feedback = report_data.get("communication_feedback", "No grammatical issues found.")

    body = f"""
    <div style="background: #4ECDC4; border: 4px solid #000; padding: 20px; box-shadow: 6px 6px 0px #000; text-align: center; margin-bottom: 32px;">
        <h2 style="font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; color: #000;">
            AI INTERVIEW ASSESSMENT READY
        </h2>
    </div>

    <!-- Score card -->
    <div style="background: #FFF; border: 4px solid #000; padding: 32px; box-shadow: 8px 8px 0px #000; text-align: center; margin-bottom: 32px;">
        <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 12px; color: #000;">FINAL SCORE</div>
        <div style="font-size: 64px; font-weight: 900; color: #FF6B6B; text-shadow: 4px 4px 0px #000; line-height: 1;">
            {score}/100
        </div>
    </div>

    <!-- Telemetry row -->
    <div style="display: flex; gap: 24px; margin-bottom: 32px;">
        <div style="flex: 1; background: #FFE66D; border: 4px solid #000; padding: 20px; box-shadow: 6px 6px 0px #000; text-align: center;">
            <div style="font-size: 14px; font-weight: 900; margin-bottom: 8px; color: #000;">CONFIDENCE</div>
            <div style="font-size: 32px; font-weight: 900; color: #000;">{avg_conf}%</div>
        </div>
        <div style="flex: 1; background: #FF9F1C; border: 4px solid #000; padding: 20px; box-shadow: 6px 6px 0px #000; text-align: center;">
            <div style="font-size: 14px; font-weight: 900; margin-bottom: 8px; color: #000;">EYE BLINKS</div>
            <div style="font-size: 32px; font-weight: 900; color: #000;">{blinks}</div>
        </div>
    </div>

    <!-- Overall feedback -->
    <div style="background: #FFF; border: 4px solid #000; padding: 24px; box-shadow: 6px 6px 0px #000; margin-bottom: 32px;">
        <h3 style="font-size: 18px; font-weight: 900; margin: 0 0 16px 0; text-transform: uppercase; background: #000; color: #FFF; display: inline-block; padding: 4px 12px;">OVERALL FEEDBACK</h3>
        <p style="font-size: 16px; line-height: 1.6; margin: 0; font-weight: bold; color: #000;">{feedback}</p>
    </div>

    <!-- Communication & Grammar -->
    <div style="background: #4ECDC4; border: 4px solid #000; padding: 24px; box-shadow: 6px 6px 0px #000; margin-bottom: 32px;">
        <h3 style="font-size: 18px; font-weight: 900; margin: 0 0 16px 0; text-transform: uppercase; background: #000; color: #FFF; display: inline-block; padding: 4px 12px;">GRAMMAR & COMM.</h3>
        <p style="font-size: 16px; line-height: 1.6; margin: 0; font-weight: bold; color: #000;">{comm_feedback}</p>
    </div>

    <!-- Areas for improvement -->
    <div style="background: #FFF; border: 4px solid #000; padding: 24px; box-shadow: 6px 6px 0px #000; margin-bottom: 32px;">
        <h3 style="font-size: 18px; font-weight: 900; margin: 0 0 16px 0; text-transform: uppercase; background: #000; color: #FFF; display: inline-block; padding: 4px 12px;">IMPROVE ON</h3>
        <ul style="font-size: 16px; padding-left: 20px; margin: 0; font-weight: bold; color: #000;">
            {areas_html}
        </ul>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin-top: 48px;">
        <a href="{report_url}"
           style="display: inline-block; padding: 16px 32px; background: #F5C800; color: #000; border: 4px solid #000; box-shadow: 6px 6px 0px #000; text-decoration: none; font-size: 18px; font-weight: 900; text-transform: uppercase; transition: all 0.2s;">
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
