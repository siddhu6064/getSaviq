import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from deps import get_accessible_profile, get_current_user
from services.weekly_digest_service import (
    build_weekly_financial_digest,
    dismiss_newest_persisted_digest,
    fetch_newest_persisted_digest,
    normalize_week_window,
    store_weekly_digest_payload,
)

router = APIRouter(prefix="/weekly-digest", tags=["weekly-digest"])
logger = logging.getLogger(__name__)


@router.get("/latest")
async def get_latest_weekly_digest(
    profile_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    if not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")

    profile = await get_accessible_profile(profile_id, current_user)

    newest = await fetch_newest_persisted_digest(
        digest_collection=db.weekly_digests,
        user_id=profile["user_id"],
        profile_id=profile_id,
    )

    if not newest:
        return {"digest": None, "latest": None}

    return {
        "digest": newest.get("digest_payload"),
        "latest": {
            "week_start": newest.get("week_start"),
            "week_end": newest.get("week_end"),
            "updated_at": newest.get("updated_at"),
        },
    }


@router.post("/latest/dismiss")
async def dismiss_latest_weekly_digest(
    profile_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    if not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")

    profile = await get_accessible_profile(profile_id, current_user)

    dismissed = await dismiss_newest_persisted_digest(
        digest_collection=db.weekly_digests,
        user_id=profile["user_id"],
        profile_id=profile_id,
    )
    return {"dismissed": dismissed}


@router.get("")
async def get_weekly_digest(
    profile_id: str | None = Query(None),
    week_start: date | None = Query(None),
    week_end: date | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    if not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")

    profile = await get_accessible_profile(profile_id, current_user)
    owner_user_id = profile["user_id"]

    try:
        start_dt, end_dt = normalize_week_window(week_start=week_start, week_end=week_end)
    except ValueError as exc:
        logger.error(f"Weekly digest date range error: {exc}")
        raise HTTPException(status_code=400, detail="Invalid date range.")

    digest = await build_weekly_financial_digest(
        user_id=owner_user_id,
        profile_id=profile_id,
        week_start=start_dt,
        week_end=end_dt,
        expenses_collection=db.expenses,
    )

    await store_weekly_digest_payload(
        digest_collection=db.weekly_digests,
        user_id=owner_user_id,
        profile_id=profile_id,
        week_start=start_dt,
        week_end=end_dt,
        digest_payload=digest,
    )

    summary = digest.get("summary") if isinstance(digest, dict) else None
    transaction_count = summary.get("transaction_count", 0) if isinstance(summary, dict) else 0
    digest_state = "empty" if int(transaction_count or 0) <= 0 else "success"

    return {
        **digest,
        "state": digest_state,
    }
