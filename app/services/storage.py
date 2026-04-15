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
        """Extracts the object key from the full R2 URL."""
        if not url: return ""
        prefix = f"{settings.R2_ENDPOINT_URL}/{settings.R2_BUCKET_NAME}/"
        if url.startswith(prefix):
            return url[len(prefix):]
        return url

storage_service = StorageService()
