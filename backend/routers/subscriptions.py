from fastapi import APIRouter, Depends, Query

from database import db
from deps import get_accessible_profile, get_current_user
from services.recurring_detection_service import detect_recurring_profile_summary

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/summary")
async def get_subscriptions_summary(
    profile_id: str = Query(...),
    lookback_days: int = Query(400, ge=30, le=730),
    current_user: dict = Depends(get_current_user),
):
    profile = await get_accessible_profile(profile_id, current_user)

    return await detect_recurring_profile_summary(
        user_id=profile["user_id"],
        profile_id=profile_id,
        expenses_collection=db.expenses,
        lookback_days=lookback_days,
    )
