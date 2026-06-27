from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── JWT ──
    SECRET_KEY: str = "change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    ALGORITHM: str = "HS256"

    # ── MongoDB ──
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "smartapply"

    # ── Brevo (Email OTP) ──
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "noreply@smartapply.com"
    BREVO_SENDER_NAME: str = "Smart Apply"

    # ── NVIDIA NIM (AI) ──
    NVIDIA_API_KEY: str = ""
    NVIDIA_MODEL: str = "nvidia/llama-3.1-nemotron-ultra-253b-v1"
    NVIDIA_IMAGE: str = ""
    NVIDIA_IMAGE_MODEL: str = "meta/llama-3.2-90b-vision-instruct"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"

    # ── Cloudflare R2 (Storage) ──
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "smartapply-uploads"
    R2_PUBLIC_URL: Optional[str] = None

    # ── Groq (Voice Interview) ──
    GROQ_API_KEY: str = ""

    # ── App URLs ──
    FRONTEND_URL: str = "https://smartapplies.app"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
