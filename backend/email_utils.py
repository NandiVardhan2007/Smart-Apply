"""
email_utils.py — Mailjet HTTP API
====================================
Mailjet uses HTTPS (port 443) — works on Render free tier.
No domain verification needed — just verify your Gmail address.
Free tier: 200 emails/day, 6,000/month.

One-time setup (3 minutes):
  1. Sign up at https://app.mailjet.com/signup (free)
  2. Go to: https://app.mailjet.com/account/sender
     → Click "Add a Sender Domain or Address"
     → Choose "Single email address"
     → Enter: kovvurinandivardhanreddy7@gmail.com
     → Mailjet sends a verification link to that Gmail → click it
  3. Go to: https://app.mailjet.com/account/apikeys
     → Copy your API Key and Secret Key
  4. Set in Render Dashboard → Environment Variables:
       MAILJET_API_KEY    = your-api-key
       MAILJET_SECRET_KEY = your-secret-key
       MAILJET_FROM       = kovvurinandivardhanreddy7@gmail.com
       MAILJET_FROM_NAME  = SmartApply
  5. Redeploy → emails work to ANY address

Why Mailjet:
  ✅ HTTP API (port 443) — Render never blocks this
  ✅ No domain required — just verify a single Gmail address
  ✅ Free 200 emails/day, 6,000/month
  ✅ Sends to any email in the world after sender verification
  ✅ Better deliverability than raw Gmail SMTP
"""

import logging
import httpx
import base64

from backend.config import (
    APP_URL,
    MAILJET_API_KEY,
    MAILJET_SECRET_KEY,
    MAILJET_FROM,
    MAILJET_FROM_NAME,
)

logger = logging.getLogger(__name__)

MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send"


async def _send(to: str, subject: str, html: str) -> None:
    """Send email via Mailjet HTTP API."""

    # ── Config guard ─────────────────────────────────────────────────────
    if not MAILJET_API_KEY or not MAILJET_SECRET_KEY:
        msg = (
            "MAILJET_API_KEY or MAILJET_SECRET_KEY not set. "
            "Sign up at mailjet.com, verify your Gmail as sender, "
            "then add both keys to Render environment variables."
        )
        logger.error(f"[Email] {msg}")
        raise RuntimeError(msg)

    # ── Build payload ─────────────────────────────────────────────────────
    payload = {
        "Messages": [
            {
                "From": {
                    "Email": MAILJET_FROM,
                    "Name":  MAILJET_FROM_NAME,
                },
                "To": [{"Email": to}],
                "Subject": subject,
                "HTMLPart": html,
            }
        ]
    }

    # Mailjet uses HTTP Basic Auth (API key : Secret key)
    credentials = base64.b64encode(
        f"{MAILJET_API_KEY}:{MAILJET_SECRET_KEY}".encode()
    ).decode()

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                MAILJET_SEND_URL,
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            )

        body = resp.text[:500]

        if resp.status_code in (200, 201):
            try:
                data   = resp.json()
                msg_id = data["Messages"][0].get("To", [{}])[0].get("MessageID", "?")
            except Exception:
                msg_id = "?"
            logger.info(f"[Mailjet] ✅ Sent '{subject}' → {to} (id={msg_id})")
            return

        # ── Descriptive errors ────────────────────────────────────────────
        if resp.status_code == 401:
            raise RuntimeError(
                "Mailjet API key or secret is wrong. "
                "Check MAILJET_API_KEY and MAILJET_SECRET_KEY in Render."
            )
        if resp.status_code == 403:
            raise RuntimeError(
                f"Mailjet rejected the sender '{MAILJET_FROM}'. "
                "You must verify this email address first: "
                "Go to app.mailjet.com/account/sender → add single email address → verify."
            )
        if resp.status_code == 429:
            raise RuntimeError("Mailjet rate limit hit. Free plan: 200 emails/day, 6000/month.")

        raise RuntimeError(f"Mailjet HTTP {resp.status_code}: {body}")

    except httpx.TimeoutException:
        raise RuntimeError("Mailjet API timed out. Try again in a moment.")
    except httpx.ConnectError as exc:
        raise RuntimeError(f"Cannot reach Mailjet API: {exc}")
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


# ── Templates ──────────────────────────────────────────────────────────────────

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
