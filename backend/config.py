import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Try to load from admin_config.json ────────────────────────────────────────
_admin_cfg: dict = {}
_admin_cfg_path = Path(__file__).parent.parent / "admin_config.json"
if _admin_cfg_path.exists():
    try:
        with open(_admin_cfg_path) as f:
            _admin_cfg = json.load(f)
    except Exception:
        pass

# ── Required secrets — raise clearly if missing ────────────────────────────────
def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(
            f"Environment variable '{key}' is required but not set. "
            f"Add it to your .env file or Render Dashboard."
        )
    return val

MONGO_URI       = _require("MONGO_URI")
JWT_SECRET      = _require("JWT_SECRET")

DB_NAME         = os.getenv("DB_NAME", "smartapply")
JWT_ALGORITHM   = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

SMTP_HOST       = _admin_cfg.get("smtp_host") or os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT       = int(_admin_cfg.get("smtp_port") or os.getenv("SMTP_PORT", "587"))
SMTP_USER       = _admin_cfg.get("smtp_user") or os.getenv("SMTP_USER", "")
SMTP_PASS       = _admin_cfg.get("smtp_pass") or os.getenv("SMTP_PASS", "")
SMTP_FROM       = os.getenv("SMTP_FROM", f"SmartApply <{SMTP_USER}>")

# ── Resend (fast transactional email — https://resend.com) ────────────────────
# Set RESEND_API_KEY in Render Dashboard (e.g. re_xxxxxxxxxxxx)
# Set RESEND_FROM to your verified sender, e.g. "SmartApply <noreply@yourdomain.com>"
# Until you verify a domain, use the Resend sandbox: "onboarding@resend.dev" (only delivers to your own email)
RESEND_API_KEY   = os.getenv("RESEND_API_KEY", "")
RESEND_FROM      = os.getenv("RESEND_FROM", "SmartApply <onboarding@resend.dev>")

APP_URL         = os.getenv("APP_URL", "http://localhost:8000")
FRONTEND_URL    = os.getenv("FRONTEND_URL", "http://localhost:8000")

# ── Encryption key for platform passwords ─────────────────────────────────────
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_KEY      = os.getenv("FERNET_KEY", "")

# ── NVIDIA NIM API ─────────────────────────────────────────────────────────────
NVIDIA_API_KEYS: list[str] = []
_keys_env = os.getenv("NVIDIA_API_KEYS", "")
if _keys_env:
    NVIDIA_API_KEYS = [k.strip() for k in _keys_env.split(",") if k.strip()]

NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_MODEL   = _admin_cfg.get("nvidia_model") or os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")

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
