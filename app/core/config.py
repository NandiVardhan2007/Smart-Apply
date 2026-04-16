from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    MONGO_URI: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ENDPOINT_URL: str
    R2_BUCKET_NAME: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    BREVO_API_KEY: str
    BREVO_FROM: str
    NVIDIA_NIM_KEY_1: Optional[str] = None
    NVIDIA_NIM_KEY_2: Optional[str] = None
    NVIDIA_NIM_KEY_3: Optional[str] = None
    
    RENDER_EXTERNAL_URL: str = "https://smart-apply-tn6h.onrender.com"
    PING_INTERVAL: int = 180 # 3 minutes
    ADMIN_EMAIL: str = "kovvurinandivardhanreddy2007@gmail.com"
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10MB

    class Config:
        env_file = ".env"

settings = Settings()
