import logging
from typing import List

from fastapi import APIRouter, Depends

from database import db
from deps import get_current_user
from models import MessageResponse, NotificationResponse

router = APIRouter(tags=["notifications"])
logger = logging.getLogger(__name__)


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(
    current_user: dict = Depends(get_current_user),
):
    """Return last 20 notifications for the user, unread first."""
    user_id = current_user["user_id"]
    cursor = (
        db.notifications.find({"user_id": user_id})
        .sort([("read", 1), ("created_at", -1)])
        .limit(20)
    )
    docs = [_serialize(doc) async for doc in cursor]
    return docs


@router.put("/notifications/read-all", response_model=MessageResponse)
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    user_id = current_user["user_id"]
    result = await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"message": f"{result.modified_count} notifications marked read"}
