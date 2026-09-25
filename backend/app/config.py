from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── JWT ──
    SECRET_KEY: str = "change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days (43200 minutes)
    ALGORITHM: str = "HS256"

    # ── MongoDB ──
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "smartapply"

    # ── Redis (Pub/Sub for WebSockets) ──
    REDIS_URL: str = "redis://localhost:6379"

    # ── Brevo (Email OTP) ──
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "noreply@smartapply.com"
    BREVO_SENDER_NAME: str = "Smart Apply"

    # ── NVIDIA NIM (AI) ──
    NVIDIA_API_KEY: str = ""
    NVIDIA_MODEL: str = "meta/llama-3.2-11b-vision-instruct"
    NVIDIA_IMAGE: str = ""
    NVIDIA_IMAGE_MODEL: str = "meta/llama-3.2-11b-vision-instruct"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    
    CHATBOT_API_KEY: str = ""

    # ── Job Search (Adzuna & RapidAPI JSearch) ──
    ADZUNA_APP_ID: str = ""
    ADZUNA_APP_KEY: str = ""
    RAPIDAPI_KEY: str = ""

    # ── Cloudflare R2 (Storage) ──
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "smartapply-uploads"
    R2_PUBLIC_URL: Optional[str] = None

    # ── Groq (Voice Interview) ──
    GROQ_API_KEY: str = ""

    # ── Judge0 CE (Code Execution Sandbox) ──
    JUDGE0_API_KEY: str = ""
    JUDGE0_API_HOST: str = "judge0-ce.p.rapidapi.com"
    JUDGE0_API_URL: str = "https://judge0-ce.p.rapidapi.com"

    # ── App URLs ──
    FRONTEND_URL: str = "https://smartapplies.app"
    ENVIRONMENT: str = "development"

    # ── Rate limiting ──
    # Number of trusted reverse-proxy hops in front of the app. The client IP is
    # read this many entries from the RIGHT of X-Forwarded-For, so a client can't
    # spoof its rate-limit identity by prepending fake IPs. Render puts a single
    # proxy in front of the service, hence the default of 1. Increase this only if
    # you add more trusted proxies (e.g. Cloudflare in front of Render → 2).
    TRUSTED_PROXY_HOPS: int = 1

    # ── LaTeX Service ──
    LATEX_FALLBACK_URL: Optional[str] = None

    @field_validator("MONGODB_URI", "REDIS_URL", "SECRET_KEY", mode="before")
    @classmethod
    def clean_env_strings(cls, v):
        if isinstance(v, str):
            cleaned = v.strip().strip('"').strip("'")
            return cleaned if cleaned else v
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()


def assert_secure_config() -> None:
    """Fail fast at startup if critical secrets are left at insecure defaults.

    Guards every environment except an explicit local ``development`` run, so a
    blank or mistyped ENVIRONMENT (e.g. a forgotten prod flag) can't silently
    boot with the well-known default JWT signing key."""
    if settings.ENVIRONMENT == "development":
        return

    errors: list[str] = []
    if not settings.SECRET_KEY or settings.SECRET_KEY == "change-this-in-production":
        errors.append("SECRET_KEY must be set to a strong, unique value.")
    if not settings.MONGODB_URI or settings.MONGODB_URI.startswith("mongodb://localhost"):
        errors.append("MONGODB_URI must point at the production database, not localhost.")
    if not settings.BREVO_API_KEY:
        errors.append("BREVO_API_KEY is required for OTP/email delivery.")
    if not settings.NVIDIA_API_KEY:
        errors.append("NVIDIA_API_KEY is required for AI features.")

    if errors:
        raise RuntimeError(
            "Insecure/incomplete configuration outside development:\n  - "
            + "\n  - ".join(errors)
        )
