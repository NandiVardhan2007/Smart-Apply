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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    BREVO_API_KEY: str
    BREVO_FROM: str
    NVIDIA_NIM_KEY_1: Optional[str] = None
    NVIDIA_NIM_KEY_2: Optional[str] = None
    NVIDIA_NIM_KEY_3: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
