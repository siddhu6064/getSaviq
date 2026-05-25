"""
Fire-and-forget Expo push notification service.

Usage:
    asyncio.create_task(send_push(user_id, "Title", "Body", data={"link": "/budgets"}))

Never await send_push directly in a request handler — use create_task.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from database import db
from models import Notification

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH_SIZE = 100  # Expo allows up to 100 per request


async def _remove_stale_token(expo_push_token: str) -> None:
    """Remove a token that Expo reports as invalid/unregistered."""
    result = await db.push_tokens.delete_one({"expo_push_token": expo_push_token})
    if result.deleted_count:
        logger.info("Removed stale push token: %s", expo_push_token)


async def _write_notification(
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    link: str | None = None,
) -> None:
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        body=body,
        link=link,
    )
    await db.notifications.insert_one(notif.model_dump())


async def send_push(
    user_id: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    notif_type: str = "general",
    link: str | None = None,
) -> None:
    """
    Fetch all push tokens for user, batch-send via Expo Push API,
    clean up stale tokens, write notification doc.

    Always fire via asyncio.create_task — never block a request.
    """
    if data is None:
        data = {}

    try:
        # 1. Write notification record first (always, even if no tokens)
        await _write_notification(user_id, notif_type, title, body, link)

        # 2. Fetch tokens
        cursor = db.push_tokens.find({"user_id": user_id}, {"expo_push_token": 1})
        tokens = [doc["expo_push_token"] async for doc in cursor]

        if not tokens:
            return

        # 3. Build messages
        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data,
                "sound": "default",
            }
            for token in tokens
        ]

        # 4. Send in batches
        stale: list[str] = []
        async with httpx.AsyncClient(timeout=10) as client:
            for i in range(0, len(messages), BATCH_SIZE):
                batch = messages[i : i + BATCH_SIZE]
                batch_tokens = tokens[i : i + BATCH_SIZE]
                try:
                    resp = await client.post(
                        EXPO_PUSH_URL,
                        json=batch,
                        headers={"Accept": "application/json", "Content-Type": "application/json"},
                    )
                    resp.raise_for_status()
                    results = resp.json().get("data", [])
                    for j, result in enumerate(results):
                        if result.get("status") == "error":
                            details = result.get("details", {})
                            err = details.get("error", "")
                            if err in ("DeviceNotRegistered", "InvalidCredentials"):
                                stale.append(batch_tokens[j])
                            else:
                                logger.warning(
                                    "Push error for token %s: %s",
                                    batch_tokens[j],
                                    result.get("message"),
                                )
                except httpx.HTTPError as exc:
                    logger.error("Expo push HTTP error: %s", exc)

        # 5. Clean stale tokens
        for token in stale:
            await _remove_stale_token(token)

    except Exception:
        logger.exception("send_push failed for user_id=%s", user_id)


async def send_weekly_digest_pushes() -> None:
    """
    APScheduler job — runs Monday 9 am UTC.
    For each user with weekly_digest_push=True, calculate 7-day income/spend
    and send a push notification.
    """
    from datetime import timedelta

    try:
        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=7)

        # Find all users who opted in
        cursor = db.user_settings.find({"weekly_digest_push": True}, {"user_id": 1})
        user_ids = [doc["user_id"] async for doc in cursor]

        if not user_ids:
            logger.info("weekly_digest_push: no opted-in users")
            return

        for user_id in user_ids:
            try:
                pipeline = [
                    {
                        "$match": {
                            "user_id": user_id,
                            "type": {"$in": ["expense", "income"]},
                            "date": {"$gte": week_start},
                        }
                    },
                    {
                        "$group": {
                            "_id": "$type",
                            "total": {"$sum": "$amount"},
                        }
                    },
                ]
                results = await db.expenses.aggregate(pipeline).to_list(10)
                income = next((r["total"] for r in results if r["_id"] == "income"), 0.0)
                spend = next((r["total"] for r in results if r["_id"] == "expense"), 0.0)

                await send_push(
                    user_id=user_id,
                    title="Your weekly digest is ready",
                    body=f"${income:,.0f} in, ${spend:,.0f} out this week",
                    data={"link": "/dashboard"},
                    notif_type="weekly_digest",
                    link="/dashboard",
                )
            except Exception:
                logger.exception("weekly_digest_push failed for user_id=%s", user_id)

    except Exception:
        logger.exception("send_weekly_digest_pushes job failed")
