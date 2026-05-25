import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from deps import get_current_user
from models import MessageResponse, PushToken, PushTokenCreate

router = APIRouter(tags=["push"])
logger = logging.getLogger(__name__)


@router.post("/push/register", response_model=MessageResponse, status_code=200)
async def register_push_token(
    payload: PushTokenCreate,
    current_user: dict = Depends(get_current_user),
):
    """Upsert a push token for the current user. Call on every app launch."""
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc)

    existing = await db.push_tokens.find_one(
        {"user_id": user_id, "expo_push_token": payload.expo_push_token}
    )

    if existing:
        await db.push_tokens.update_one(
            {"user_id": user_id, "expo_push_token": payload.expo_push_token},
            {"$set": {"last_active": now, "device_type": payload.device_type}},
        )
        return {"message": "push token updated"}

    token = PushToken(
        user_id=user_id,
        expo_push_token=payload.expo_push_token,
        device_type=payload.device_type,
    )
    await db.push_tokens.insert_one(token.model_dump())
    return {"message": "push token registered"}
