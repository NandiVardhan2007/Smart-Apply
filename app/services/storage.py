import boto3
import asyncio
import logging
from botocore.exceptions import ClientError
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name='auto'  # R2 expects 'auto'
        )

    async def upload_file(self, file_data, file_name, content_type):
        try:
            # Wrap blocking S3 call in a thread
            await asyncio.to_thread(
                self.s3.put_object,
                Bucket=settings.R2_BUCKET_NAME,
                Key=file_name,
                Body=file_data,
                ContentType=content_type
            )
            return f"{settings.R2_ENDPOINT_URL}/{settings.R2_BUCKET_NAME}/{file_name}"
        except ClientError as e:
            logger.error(f"R2 Upload Error: {e}")
            return None

    async def generate_presigned_url(self, file_name, expiration=3600):
        try:
            # Wrap blocking S3 call in a thread
            url = await asyncio.to_thread(
                self.s3.generate_presigned_url,
                'get_object',
                Params={'Bucket': settings.R2_BUCKET_NAME, 'Key': file_name},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            logger.error(f"R2 Presigned URL Error: {e}")
            return None

    def get_key_from_url(self, url: str) -> str:
        """Extracts the object key from a full R2 URL. Handles trailing slash variants."""
        if not url:
            return ""
        # If it's already a bare key (no scheme), return as-is
        if not url.startswith("http"):
            return url
        # Normalize: strip trailing slash from endpoint before building prefix
        base = settings.R2_ENDPOINT_URL.rstrip("/")
        bucket = settings.R2_BUCKET_NAME.strip("/")
        prefix = f"{base}/{bucket}/"
        if url.startswith(prefix):
            return url[len(prefix):]
        # Fallback: find the bucket name in the path and extract everything after it
        marker = f"/{bucket}/"
        idx = url.find(marker)
        if idx != -1:
            return url[idx + len(marker):]
        # Last resort: return the path component after the hostname
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path.lstrip("/")
            # Remove bucket prefix from path if present
            if path.startswith(bucket + "/"):
                return path[len(bucket) + 1:]
            return path
        except Exception:
            return url

storage_service = StorageService()
