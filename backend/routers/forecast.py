from fastapi import APIRouter, Depends, Query

from database import db
from deps import get_accessible_profile, get_current_user
from services.forecast_service import generate_cash_flow_forecast, generate_spend_forecast

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("")
async def get_forecast(
    profile_id: str = Query(...),
    recent_days: int = Query(30, ge=7, le=90),
    current_user: dict = Depends(get_current_user),
):
    profile = await get_accessible_profile(profile_id, current_user)

    return await generate_spend_forecast(
        user_id=profile["user_id"],
        profile_id=profile_id,
        expenses_collection=db.expenses,
        budgets_collection=db.budgets,
        recent_days=recent_days,
    )


@router.get("/cash-flow")
async def get_cash_flow_forecast(
    profile_id: str = Query(...),
    days: int = Query(30, ge=7, le=90),
    current_user: dict = Depends(get_current_user),
):
    profile = await get_accessible_profile(profile_id, current_user)

    return await generate_cash_flow_forecast(
        user_id=profile["user_id"],
        profile_id=profile_id,
        expenses_collection=db.expenses,
        bills_collection=db.bills,
        days=days,
    )
