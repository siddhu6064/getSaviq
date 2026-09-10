from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from database import db
from deps import get_accessible_profile, get_current_user
from models import MessageResponse, TripBudget, TripBudgetCreate, TripBudgetResponse, TripBudgetUpdate

router = APIRouter(prefix="/trip-budgets", tags=["trip-budgets"])


async def _ensure_owned_category(category_id: str, user_id: str) -> None:
    doc = await db.categories.find_one({"category_id": category_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")


async def _enrich_trip(trip: dict) -> dict:
    match: dict = {
        "user_id": trip["user_id"],
        "profile_id": trip["profile_id"],
        "type": "expense",
        "date": {"$gte": trip["start_date"], "$lte": trip["end_date"]},
    }
    if trip.get("category_id"):
        match["category_id"] = trip["category_id"]

    matching_expenses = await db.expenses.find(match, {"_id": 0, "amount": 1}).to_list(5000)
    spent = sum(e["amount"] for e in matching_expenses)

    amount = trip["amount"]
    remaining = amount - spent
    percentage = (spent / amount * 100) if amount else 0.0

    end_date = trip["end_date"]
    end_date = end_date if end_date.tzinfo else end_date.replace(tzinfo=timezone.utc)
    days_remaining = (end_date - datetime.now(timezone.utc)).days

    return {
        **trip,
        "spent": spent,
        "remaining": remaining,
        "percentage": round(percentage, 2),
        "is_over_budget": spent > amount,
        "days_remaining": days_remaining,
    }


@router.post("", response_model=TripBudgetResponse)
async def create_trip_budget(
    data: TripBudgetCreate,
    current_user: dict = Depends(get_current_user),
):
    await get_accessible_profile(data.profile_id, current_user)
    if data.category_id:
        await _ensure_owned_category(data.category_id, current_user["user_id"])

    trip = TripBudget(user_id=current_user["user_id"], **data.model_dump())
    await db.trip_budgets.insert_one(trip.model_dump())
    return await _enrich_trip(trip.model_dump())


@router.get("", response_model=list[TripBudgetResponse])
async def list_trip_budgets(
    profile_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if profile_id:
        await get_accessible_profile(profile_id, current_user)
        query: dict = {"profile_id": profile_id}
    else:
        query = {"user_id": current_user["user_id"]}

    trips = await db.trip_budgets.find(query, {"_id": 0}).sort("start_date", -1).to_list(200)
    return [await _enrich_trip(trip) for trip in trips]


@router.get("/{trip_id}", response_model=TripBudgetResponse)
async def get_trip_budget(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trip_budgets.find_one(
        {"trip_id": trip_id, "user_id": current_user["user_id"]}, {"_id": 0}
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip budget not found")
    return await _enrich_trip(trip)


@router.put("/{trip_id}", response_model=TripBudgetResponse)
async def update_trip_budget(
    trip_id: str,
    data: TripBudgetUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await db.trip_budgets.find_one(
        {"trip_id": trip_id, "user_id": current_user["user_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Trip budget not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    if update_data.get("category_id"):
        await _ensure_owned_category(update_data["category_id"], current_user["user_id"])

    merged_start = update_data.get("start_date", existing["start_date"])
    merged_end = update_data.get("end_date", existing["end_date"])
    if merged_end < merged_start:
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated = await db.trip_budgets.find_one_and_update(
        {"trip_id": trip_id, "user_id": current_user["user_id"]},
        {"$set": update_data},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    return await _enrich_trip(updated)


@router.delete("/{trip_id}", response_model=MessageResponse)
async def delete_trip_budget(trip_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.trip_budgets.delete_one(
        {"trip_id": trip_id, "user_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip budget not found")
    return {"message": "Trip budget deleted"}
