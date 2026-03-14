import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Try to load from admin_config.json (overrides .env for SMTP/keys) ────────
_admin_cfg: dict = {}
_admin_cfg_path = Path(__file__).parent.parent / "admin_config.json"
if _admin_cfg_path.exists():
    try:
        with open(_admin_cfg_path) as f:
            _admin_cfg = json.load(f)
    except Exception:
        pass

MONGO_URI       = os.getenv("MONGO_URI", "mongodb+srv://Nandu:Motu20172007@smartapply.qdyfwh9.mongodb.net/?appName=SmartApply")
DB_NAME         = os.getenv("DB_NAME", "smartapply")

JWT_SECRET      = os.getenv("JWT_SECRET", "smartapply_super_secret_jwt_key_2024")
JWT_ALGORITHM   = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

SMTP_HOST       = _admin_cfg.get("smtp_host") or os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT       = int(_admin_cfg.get("smtp_port") or os.getenv("SMTP_PORT", "587"))
SMTP_USER       = _admin_cfg.get("smtp_user") or os.getenv("SMTP_USER", "")
SMTP_PASS       = _admin_cfg.get("smtp_pass") or os.getenv("SMTP_PASS", "")
SMTP_FROM       = os.getenv("SMTP_FROM", f"SmartApply <{SMTP_USER}>")

# ── Mailersend (HTTP email API — works on Render, 3,000 emails/month free) ────
# Sign up free at https://mailersend.com — no credit card needed
MAILERSEND_API_KEY   = _admin_cfg.get("mailersend_api_key") or os.getenv("MAILERSEND_API_KEY", "")
MAILERSEND_FROM      = os.getenv("MAILERSEND_FROM", "noreply@trial-XXXXXXXX.mlsender.net")  # replace with your Mailersend trial/domain
MAILERSEND_FROM_NAME = os.getenv("MAILERSEND_FROM_NAME", "SmartApply")

APP_URL         = os.getenv("APP_URL", "http://localhost:8000")
FRONTEND_URL    = os.getenv("FRONTEND_URL", "http://localhost:8000")

# ── OpenRouter keys ───────────────────────────────────────────────────────────
# Keys are stored ONLY in Render environment variables, never in code files.
# Set OPENROUTER_KEYS in Render as a comma-separated string of keys.
OPENROUTER_KEYS: list[str] = []

_keys_env = os.getenv("OPENROUTER_KEYS", "")
if _keys_env:
    OPENROUTER_KEYS = [k.strip() for k in _keys_env.split(",") if k.strip()]

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL   = _admin_cfg.get("openrouter_model") or os.getenv("OPENROUTER_MODEL", "mistralai/mistral-7b-instruct:free")

BOT_ENABLED = os.getenv("BOT_ENABLED", "false").lower() == "true"

# ── Security ──────────────────────────────────────────────────────────────────
DISPOSABLE_DOMAINS = {
    "tempmail.com","temp-mail.org","guerrillamail.com","guerrillamail.net",
    "guerrillamail.org","10minutemail.com","10minutemail.net","mailinator.com",
    "throwam.com","trashmail.com","yopmail.com","fakeinbox.com","dispostable.com",
    "maildrop.cc","sharklasers.com","guerrillamailblock.com","grr.la",
    "spam4.me","spamdecoy.net","spamfree24.org","spamgourmet.com",
    "0-mail.com","discardmail.com","mailnull.com","spammotel.com",
    "mytemp.email","tempr.email","discard.email","spamgrap.de",
    "filzmail.com","spamhere.com","tempinbox.com","objectmail.com",
    "ownmail.net","pecinan.com","putthisinyourspamdatabase.com",
}

MAX_LOGIN_ATTEMPTS     = 5
PIN_EXPIRY_MINUTES     = 15
RESET_TOKEN_EXPIRY_HRS = 1
