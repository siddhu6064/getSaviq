"""
Cloudflare R2 upload/delete service.

Uses boto3 with R2-compatible S3 endpoint.
All boto3 calls run in a thread executor to avoid blocking the async event loop.
"""
import asyncio
import logging
from functools import partial

logger = logging.getLogger(__name__)


def _get_client():
    """Build a boto3 S3 client pointed at Cloudflare R2."""
    import boto3
    from config import get_settings

    settings = get_settings()
    if not settings.CLOUDFLARE_ACCOUNT_ID:
        raise RuntimeError("CLOUDFLARE_ACCOUNT_ID is not configured")
    if not settings.CLOUDFLARE_R2_ACCESS_KEY_ID or not settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY:
        raise RuntimeError("Cloudflare R2 credentials are not configured")

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _upload_sync(file_bytes: bytes, key: str, content_type: str) -> None:
    from config import get_settings

    settings = get_settings()
    client = _get_client()
    client.put_object(
        Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )


def _delete_sync(key: str) -> None:
    from config import get_settings

    settings = get_settings()
    client = _get_client()
    client.delete_object(Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME, Key=key)


async def upload_file(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    folder: str,
) -> str:
    """
    Upload *file_bytes* to R2 at key ``{folder}/{filename}``.
    Returns the object key — NOT a public URL.
    Access the file via generate_presigned_url(key).
    """
    key = f"{folder}/{filename}"
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, partial(_upload_sync, file_bytes, key, content_type))
    logger.info("r2 upload key=%s", key)
    return key


async def delete_file(filename: str, folder: str) -> None:
    """
    Delete the object at key ``{folder}/{filename}`` from R2.
    """
    key = f"{folder}/{filename}"
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, partial(_delete_sync, key))
    logger.info("r2 delete key=%s", key)


def generate_presigned_url(key: str, expiry: int = 900) -> str:
    """
    Generate a time-limited presigned GET URL for an R2 object key.
    Default TTL: 900 seconds (15 minutes).
    """
    from config import get_settings

    settings = get_settings()
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.CLOUDFLARE_R2_BUCKET_NAME, "Key": key},
        ExpiresIn=expiry,
    )


def key_from_url(url: str) -> str | None:
    """
    Extract the R2 object key from a stored value.
    Handles both legacy public URLs and new plain object keys.
    """
    if not url:
        return None
    # Already a plain key (not a URL)
    if not url.startswith("http"):
        return url
    # Legacy: strip R2 bucket URL prefix for data stored before presigned-URL migration
    from config import get_settings

    settings = get_settings()
    if settings.CLOUDFLARE_ACCOUNT_ID and settings.CLOUDFLARE_R2_BUCKET_NAME:
        fallback = f"https://{settings.CLOUDFLARE_R2_BUCKET_NAME}.{settings.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/"
        if url.startswith(fallback):
            return url[len(fallback):]
    return None
