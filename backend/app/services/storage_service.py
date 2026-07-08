import uuid
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig

from app.config import settings

_s3_client = None


def _get_client():
    """Lazy-initialize the S3 client configured for Cloudflare R2."""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            service_name="s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=BotoConfig(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )
    return _s3_client


def upload_file(
    file_bytes: bytes,
    original_filename: str,
    folder: str = "uploads",
    content_type: str = "application/octet-stream",
) -> str:
    """Upload a file to Cloudflare R2 and return the object key."""
    client = _get_client()
    ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"

    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return key


def get_file_url(key: str) -> str:
    """Get the public URL for a stored file."""
    import urllib.parse
    safe_key = urllib.parse.quote(key)
    if settings.R2_PUBLIC_URL:
        return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{safe_key}"
    return f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{settings.R2_BUCKET_NAME}/{safe_key}"


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for temporary file access."""
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_file(key: str) -> bool:
    """Delete a file from R2."""
    try:
        client = _get_client()
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return True
    except Exception:
        return False
