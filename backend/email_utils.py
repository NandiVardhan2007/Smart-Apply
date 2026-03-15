"""
email_utils.py — Resend HTTP API
==================================
Resend is the easiest email API — no domain needed to start.
Free tier: 3,000 emails/month, 100/day.

One-time setup (2 minutes):
  1. Sign up at https://resend.com  (free, no credit card)
  2. Go to https://resend.com/api-keys  → Create API Key → copy it
  3. In Render Dashboard → Environment Variables → add:
       RESEND_API_KEY = re_xxxxxxxxxxxx
  4. Redeploy — done!

The FROM address is automatically set to onboarding@resend.dev on the
free plan (no domain needed). You can send to ANY email address.

Optional: to send FROM your own domain later, verify it at resend.com/domains.
"""

import logging
import httpx

from backend.config import APP_URL
import os

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _get_key() -> str:
    key = os.getenv("RESEND_API_KEY", "")
    if not key:
        raise RuntimeError(
            "RESEND_API_KEY is not set.\n"
            "Fix:\n"
            "  1. Sign up free at https://resend.com\n"
            "  2. Go to https://resend.com/api-keys → Create API Key\n"
            "  3. Add RESEND_API_KEY=re_xxxx in Render Dashboard → Environment\n"
            "  4. Redeploy"
        )
    return key


def _get_from() -> str:
    """
    Use custom FROM if RESEND_FROM is set (requires verified domain).
    Otherwise fall back to Resend's free shared sender — works immediately.
    """
    return os.getenv("RESEND_FROM", "SmartApply <onboarding@resend.dev>")


async def _send(to: str, subject: str, html: str) -> None:
    """Send email via Resend HTTP API."""
    api_key  = _get_key()
    from_addr = _get_from()

    payload = {
        "from":    from_addr,
        "to":      [to],
        "subject": subject,
        "html":    html,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            )

        logger.info(f"[Resend] HTTP {resp.status_code} | {resp.text[:300]}")

        if resp.status_code in (200, 201):
            logger.info(f"[Resend] ✅ Sent '{subject}' → {to}")
            return

        body = resp.text[:400]

        if resp.status_code == 401:
            raise RuntimeError(
                f"Resend 401 — API key is wrong or missing.\n"
                f"Check RESEND_API_KEY in Render Dashboard.\n"
                f"Response: {body}"
            )
        if resp.status_code == 403:
            raise RuntimeError(
                f"Resend 403 — sender domain not verified or account restricted.\n"
                f"Response: {body}"
            )
        if resp.status_code == 422:
            raise RuntimeError(
                f"Resend 422 — invalid request (bad email address or payload).\n"
                f"Response: {body}"
            )
        if resp.status_code == 429:
            raise RuntimeError("Resend 429 — rate limit hit (100/day on free plan).")

        raise RuntimeError(f"Resend HTTP {resp.status_code}: {body}")

    except httpx.TimeoutException:
        raise RuntimeError("Resend API timed out after 15s.")
    except httpx.ConnectError as exc:
        raise RuntimeError(f"Cannot reach Resend API: {exc}")
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