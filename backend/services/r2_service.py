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


def _build_public_url(key: str) -> str:
    from config import get_settings

    settings = get_settings()
    if settings.CLOUDFLARE_R2_PUBLIC_URL:
        return f"{settings.CLOUDFLARE_R2_PUBLIC_URL.rstrip('/')}/{key}"
    # Fallback — R2 bucket URL pattern (only works if bucket is public)
    return f"https://{settings.CLOUDFLARE_R2_BUCKET_NAME}.{settings.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/{key}"


def _upload_sync(file_bytes: bytes, key: str, content_type: str) -> str:
    from config import get_settings

    settings = get_settings()
    client = _get_client()
    client.put_object(
        Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return _build_public_url(key)


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
    Returns the public URL.
    """
    key = f"{folder}/{filename}"
    loop = asyncio.get_event_loop()
    url: str = await loop.run_in_executor(
        None, partial(_upload_sync, file_bytes, key, content_type)
    )
    logger.info("r2 upload key=%s", key)
    return url


async def delete_file(filename: str, folder: str) -> None:
    """
    Delete the object at key ``{folder}/{filename}`` from R2.
    """
    key = f"{folder}/{filename}"
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, partial(_delete_sync, key))
    logger.info("r2 delete key=%s", key)


def key_from_url(url: str) -> str | None:
    """
    Extract the R2 object key from a public URL.
    Returns None if the URL doesn't match this bucket's public base.
    """
    from config import get_settings

    settings = get_settings()
    base = settings.CLOUDFLARE_R2_PUBLIC_URL
    if base and url.startswith(base.rstrip("/") + "/"):
        return url[len(base.rstrip("/")) + 1:]
    # Fallback pattern
    if settings.CLOUDFLARE_ACCOUNT_ID and settings.CLOUDFLARE_R2_BUCKET_NAME:
        fallback = f"https://{settings.CLOUDFLARE_R2_BUCKET_NAME}.{settings.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/"
        if url.startswith(fallback):
            return url[len(fallback):]
    return None
