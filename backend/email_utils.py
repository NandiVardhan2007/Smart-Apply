"""
email_utils.py
Sends transactional emails via Resend (https://resend.com).
Fast delivery — free tier: 3,000 emails/month, 100/day.
Set RESEND_API_KEY in your .env or Render Dashboard.

Setup:
  1. Sign up at https://resend.com
  2. Verify your domain (or use sandbox for testing)
  3. Set RESEND_API_KEY=re_xxxxxxxxxxxx in Render env vars
  4. Set RESEND_FROM=SmartApply <noreply@yourdomain.com>
     (Until domain verified, use: SmartApply <onboarding@resend.dev>
      — sandbox only delivers to your own Resend-verified address)
"""

import logging
import httpx

from backend.config import APP_URL, RESEND_API_KEY, RESEND_FROM

logger = logging.getLogger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"


async def _send(to: str, subject: str, html: str):
    """Send email via Resend HTTP API."""
    if not RESEND_API_KEY:
        logger.warning(
            f"[EMAIL MOCK] No RESEND_API_KEY set. "
            f"Would send '{subject}' to {to}. "
            "Add RESEND_API_KEY to your .env or Render Dashboard."
        )
        return

    payload = {
        "from":    RESEND_FROM,
        "to":      [to],
        "subject": subject,
        "html":    html,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_SEND_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            )

        if resp.status_code in (200, 201):
            msg_id = resp.json().get("id", "?")
            logger.info(f"[Resend] Sent '{subject}' → {to} (id={msg_id})")
        else:
            logger.error(f"[Resend] Failed {resp.status_code}: {resp.text[:300]}")
            raise RuntimeError(f"Resend {resp.status_code}: {resp.text[:200]}")

    except httpx.HTTPError as exc:
        logger.error(f"[Resend] HTTP error to {to}: {exc}")
        raise RuntimeError("Email delivery failed. Check RESEND_API_KEY.") from exc


# ── Shared HTML shell ──────────────────────────────────────────────────────────

def _html(body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{{margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}}
  .wrap{{max-width:520px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.4);}}
  .hdr{{background:linear-gradient(135deg,#4f7cff,#6366f1);padding:28px 36px 20px;}}
  .hdr h1{{margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px;}}
  .hdr p{{margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px;}}
  .bdy{{padding:28px 36px 32px;color:#e2e8f0;line-height:1.65;font-size:15px;}}
  .bdy p{{margin:0 0 16px;}}
  .code-box{{background:#0f172a;border-radius:12px;padding:24px;text-align:center;margin:20px 0;}}
  .code{{font-size:40px;font-weight:800;letter-spacing:14px;color:#6366f1;font-family:'Courier New',monospace;}}
  .btn{{display:inline-block;background:linear-gradient(135deg,#4f7cff,#6366f1);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;}}
  .muted{{font-size:13px;color:#94a3b8;}}
  .ftr{{padding:14px 36px 22px;font-size:12px;color:#475569;border-top:1px solid rgba(255,255,255,.06);}}
  .ftr a{{color:#6366f1;text-decoration:none;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>⚡ SmartApply</h1>
    <p>AI-Powered Job Application Automation</p>
  </div>
  <div class="bdy">{body}</div>
  <div class="ftr">
    You received this because you signed up at SmartApply.<br>
    If you did not, you can safely ignore this email.
  </div>
</div>
</body>
</html>"""


# ── Email templates ────────────────────────────────────────────────────────────

async def send_verification_email(to: str, pin: str):
    body = f"""
<p>Thanks for signing up! Enter the code below to verify your email address.</p>
<p>The code expires in <strong>15 minutes</strong>.</p>
<div class="code-box">
  <div class="code">{pin}</div>
</div>
<p class="muted">Enter this 6-digit code in the SmartApply verification screen.</p>
"""
    await _send(to, "SmartApply — Verify Your Account", _html(body))


async def send_reset_email(to: str, token: str):
    reset_url = f"{APP_URL}/forgot-password.html?token={token}"
    body = f"""
<p>We received a request to reset your SmartApply password.</p>
<p>Click the button below — this link expires in <strong>1 hour</strong>.</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{reset_url}" class="btn">Reset Password</a>
</p>
<p class="muted">
  Or copy this link:<br>
  <a href="{reset_url}" style="color:#a5b4fc;word-break:break-all;">{reset_url}</a>
</p>
<p class="muted">If you did not request a password reset, ignore this email.</p>
"""
    await _send(to, "SmartApply — Reset Your Password", _html(body))


async def send_application_result_email(to: str, job_title: str, company: str, result: str):
    colour = "#22c55e" if result == "Applied" else "#ef4444"
    icon   = "✅" if result == "Applied" else "❌"
    body = f"""
<p>Here's an update on your recent job application:</p>
<div style="background:#0f172a;border-radius:10px;padding:20px;margin:16px 0;">
  <p style="margin:6px 0;"><strong>Job Title:</strong> {job_title}</p>
  <p style="margin:6px 0;"><strong>Company:</strong> {company}</p>
  <p style="margin:6px 0;"><strong>Status:</strong>
    <span style="color:{colour};font-weight:700;">{icon} {result}</span>
  </p>
</div>
<p style="text-align:center;margin-top:20px;">
  <a href="{APP_URL}/dashboard.html" class="btn">View Dashboard</a>
</p>
"""
    await _send(to, f"SmartApply — {icon} {result}: {job_title}", _html(body))
