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

# ── Brevo (HTTP email API — works on Render, 300 emails/day free) ─────────────
BREVO_API_KEY   = os.getenv("BREVO_API_KEY", "")
BREVO_FROM      = os.getenv("BREVO_FROM", "kovvurinandivardhanreddy7@gmail.com")
BREVO_FROM_NAME = os.getenv("BREVO_FROM_NAME", "SmartApply")

APP_URL         = os.getenv("APP_URL", "http://localhost:8000")
FRONTEND_URL    = os.getenv("FRONTEND_URL", "http://localhost:8000")

# ── NVIDIA NIM API ────────────────────────────────────────────────────────────
# Free API keys from https://build.nvidia.com/models (click "Get API Key")
# Set NVIDIA_API_KEYS in your .env or Render environment variables.
# Multiple keys can be comma-separated for fallback: key1,key2,key3
NVIDIA_API_KEYS: list[str] = []
_keys_env = os.getenv("NVIDIA_API_KEYS", "")
if _keys_env:
    NVIDIA_API_KEYS = [k.strip() for k in _keys_env.split(",") if k.strip()]

# NVIDIA NIM API endpoint (OpenAI-compatible)
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

# Default model — all are FREE on NVIDIA NIM
# Options (change via NVIDIA_MODEL env var):
#   meta/llama-3.3-70b-instruct           (70B, best overall — default)
#   meta/llama-3.1-70b-instruct           (70B, Llama 3.1)
#   google/gemma-3-27b-it                 (27B, fast)
#   nvidia/llama-3.1-nemotron-70b-instruct (70B, NVIDIA-tuned)
#   mistralai/mixtral-8x7b-instruct-v0.1  (47B, Mixtral)
# Bug fix: admin_config key is "nvidia_model", not "openrouter_model"
NVIDIA_MODEL = _admin_cfg.get("nvidia_model") or os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")

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
