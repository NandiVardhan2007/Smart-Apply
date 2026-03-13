import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from backend.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL
import asyncio


def _build_html(subject: str, body_html: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg.attach(MIMEText(body_html, "html"))
    return msg


def _send(to: str, msg: MIMEMultipart):
    if not SMTP_USER or not SMTP_PASS:
        print(f"[EMAIL MOCK] To: {to}\nSubject: {msg['Subject']}\n(SMTP not configured)")
        return
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        msg["To"] = to
        server.sendmail(SMTP_FROM, to, msg.as_string())


async def send_verification_email(to: str, pin: str):
    subject = "SmartApply – Verify Your Account"
    body = f"""
    <html><body style="font-family:Inter,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px">
    <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:40px">
      <h1 style="color:#6366f1;margin:0 0 8px">SmartApply</h1>
      <h2 style="margin:0 0 24px;font-weight:500">Verify your email</h2>
      <p>Use the code below to verify your account. It expires in <strong>15 minutes</strong>.</p>
      <div style="background:#0f172a;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#6366f1">{pin}</span>
      </div>
      <p style="font-size:13px;color:#94a3b8">If you didn't create a SmartApply account, ignore this email.</p>
    </div></body></html>
    """
    msg = _build_html(subject, body)
    await asyncio.to_thread(_send, to, msg)


async def send_reset_email(to: str, token: str):
    reset_url = f"{APP_URL}/forgot-password.html?token={token}"
    subject = "SmartApply – Reset Your Password"
    body = f"""
    <html><body style="font-family:Inter,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px">
    <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:40px">
      <h1 style="color:#6366f1;margin:0 0 8px">SmartApply</h1>
      <h2 style="margin:0 0 24px;font-weight:500">Reset your password</h2>
      <p>Click the button below to reset your password. The link expires in <strong>1 hour</strong>.</p>
      <a href="{reset_url}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a>
      <p style="font-size:13px;color:#94a3b8;margin-top:16px">Or copy this link:<br><code style="color:#a5b4fc">{reset_url}</code></p>
      <p style="font-size:13px;color:#94a3b8">If you didn't request a reset, ignore this email.</p>
    </div></body></html>
    """
    msg = _build_html(subject, body)
    await asyncio.to_thread(_send, to, msg)


async def send_application_result_email(to: str, job_title: str, company: str, result: str):
    colour = "#22c55e" if result == "Applied" else "#ef4444"
    icon   = "✅" if result == "Applied" else "❌"
    subject = f"SmartApply – {icon} Application Update: {job_title}"
    body = f"""
    <html><body style="font-family:Inter,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px">
    <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:40px">
      <h1 style="color:#6366f1;margin:0 0 8px">SmartApply</h1>
      <h2 style="margin:0 0 24px;font-weight:500">Application Update</h2>
      <div style="background:#0f172a;border-radius:12px;padding:20px;margin-bottom:20px">
        <p style="margin:4px 0"><strong>Job:</strong> {job_title}</p>
        <p style="margin:4px 0"><strong>Company:</strong> {company}</p>
        <p style="margin:4px 0"><strong>Status:</strong> <span style="color:{colour}">{result}</span></p>
      </div>
      <a href="{APP_URL}/dashboard.html" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">View Dashboard</a>
    </div></body></html>
    """
    msg = _build_html(subject, body)
    await asyncio.to_thread(_send, to, msg)
