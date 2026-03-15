"""
email_utils.py — Brevo (Sendinblue) HTTP API
=============================================
Free tier: 300 emails/day, NO domain verification needed.
Just verify your Gmail address as a sender once.

One-time setup (3 minutes):
  1. Sign up free at https://app.brevo.com  (no credit card)
  2. Go to: https://app.brevo.com/senders  (Senders & IPs → Senders)
     → Click "Add a new sender"
     → Enter name: SmartApply
     → Enter email: kovvurinandivardhanreddy7@gmail.com
     → Brevo sends a verification email to your Gmail → click the link
  3. Go to: https://app.brevo.com/settings/keys/api
     → Click "Generate a new API key"
     → Name it "SmartApply" → copy the key
  4. In Render Dashboard → Environment Variables → add:
       BREVO_API_KEY = xkeysib-xxxxxxxxxxxx
       BREVO_FROM    = kovvurinandivardhanreddy7@gmail.com
  5. Redeploy → emails work to ANY address worldwide
"""

import logging
import httpx
import os

from backend.config import APP_URL

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _get_key() -> str:
    key = os.getenv("BREVO_API_KEY", "")
    if not key:
        raise RuntimeError(
            "BREVO_API_KEY is not set in Render environment variables.\n"
            "Fix:\n"
            "  1. Sign up free at https://app.brevo.com\n"
            "  2. Settings → API Keys → Generate a new API key\n"
            "  3. Add BREVO_API_KEY=xkeysib-xxx in Render Dashboard → Environment\n"
            "  4. Redeploy"
        )
    return key


def _get_from() -> tuple[str, str]:
    """Returns (email, name) for the sender."""
    email = os.getenv("BREVO_FROM", os.getenv("SMTP_USER", ""))
    name  = os.getenv("BREVO_FROM_NAME", "SmartApply")
    if not email:
        raise RuntimeError(
            "BREVO_FROM is not set.\n"
            "Add BREVO_FROM=kovvurinandivardhanreddy7@gmail.com in Render Dashboard."
        )
    return email, name


async def _send(to: str, subject: str, html: str) -> None:
    """Send email via Brevo HTTP API."""
    api_key         = _get_key()
    from_email, from_name = _get_from()

    payload = {
        "sender":      {"name": from_name, "email": from_email},
        "to":          [{"email": to}],
        "subject":     subject,
        "htmlContent": html,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                BREVO_API_URL,
                headers={
                    "api-key":      api_key,
                    "Content-Type": "application/json",
                    "Accept":       "application/json",
                },
                json=payload,
            )

        logger.info(f"[Brevo] HTTP {resp.status_code} | {resp.text[:300]}")

        if resp.status_code in (200, 201):
            logger.info(f"[Brevo] ✅ Sent '{subject}' → {to}")
            return

        body = resp.text[:400]

        if resp.status_code == 401:
            raise RuntimeError(
                f"Brevo 401 — API key is wrong.\n"
                f"Check BREVO_API_KEY in Render Dashboard.\n"
                f"Response: {body}"
            )
        if resp.status_code == 400:
            raise RuntimeError(
                f"Brevo 400 — Bad request. Sender may not be verified.\n"
                f"Fix: https://app.brevo.com/senders → verify {from_email}\n"
                f"Response: {body}"
            )
        if resp.status_code == 403:
            raise RuntimeError(
                f"Brevo 403 — Account restricted or sender not verified.\n"
                f"Fix: https://app.brevo.com/senders → verify {from_email}\n"
                f"Response: {body}"
            )
        if resp.status_code == 429:
            raise RuntimeError("Brevo 429 — rate limit hit (300/day on free plan).")

        raise RuntimeError(f"Brevo HTTP {resp.status_code}: {body}")

    except httpx.TimeoutException:
        raise RuntimeError("Brevo API timed out after 15s.")
    except httpx.ConnectError as exc:
        raise RuntimeError(f"Cannot reach Brevo API: {exc}")
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Unexpected email error: {exc}") from exc


# ── HTML shell ─────────────────────────────────────────────────────────────────

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
  .btn-link{{display:inline-block;background:linear-gradient(135deg,#4f7cff,#6366f1);color:#fff!important;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;}}
  .muted{{font-size:13px;color:#94a3b8;}}
  .ftr{{padding:14px 36px 22px;font-size:12px;color:#475569;border-top:1px solid rgba(255,255,255,.06);}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr"><h1>⚡ SmartApply</h1><p>AI-Powered Job Application Automation</p></div>
  <div class="bdy">{body}</div>
  <div class="ftr">You received this because you signed up at SmartApply. If you did not, ignore this email.</div>
</div>
</body>
</html>"""


# ── Email templates ────────────────────────────────────────────────────────────

async def send_verification_email(to: str, pin: str) -> None:
    body = f"""
<p>Thanks for signing up! Use the code below to verify your email address.</p>
<p>Expires in <strong>15 minutes</strong>.</p>
<div class="code-box"><div class="code">{pin}</div></div>
<p class="muted">Enter this 6-digit code in the SmartApply verification screen.</p>
"""
    await _send(to, "SmartApply — Your Verification Code", _html(body))


async def send_reset_email(to: str, token: str) -> None:
    reset_url = f"{APP_URL}/forgot-password.html?token={token}"
    body = f"""
<p>We received a request to reset your SmartApply password.</p>
<p>Click the button below — expires in <strong>1 hour</strong>.</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{reset_url}" class="btn-link">Reset Password</a>
</p>
<p class="muted">Or copy this link:<br>
  <a href="{reset_url}" style="color:#a5b4fc;word-break:break-all;">{reset_url}</a>
</p>
<p class="muted">Ignore this email if you did not request a reset.</p>
"""
    await _send(to, "SmartApply — Reset Your Password", _html(body))


async def send_application_result_email(to: str, job_title: str, company: str, result: str) -> None:
    colour = "#22c55e" if result == "Applied" else "#ef4444"
    icon   = "✅" if result == "Applied" else "❌"
    body = f"""
<p>Here's an update on your job application:</p>
<div style="background:#0f172a;border-radius:10px;padding:20px;margin:16px 0;">
  <p style="margin:6px 0;"><strong>Role:</strong> {job_title}</p>
  <p style="margin:6px 0;"><strong>Company:</strong> {company}</p>
  <p style="margin:6px 0;"><strong>Status:</strong>
    <span style="color:{colour};font-weight:700;">{icon} {result}</span>
  </p>
</div>
<p style="text-align:center;"><a href="{APP_URL}/dashboard.html" class="btn-link">View Dashboard</a></p>
"""
    await _send(to, f"SmartApply — {icon} {result}: {job_title}", _html(body))