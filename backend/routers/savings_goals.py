import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from database import db
from deps import get_accessible_profile, get_current_user
from models import MessageResponse, SavingsGoal, SavingsGoalCreate, SavingsGoalResponse, SavingsGoalUpdate

logger = logging.getLogger(__name__)

GOAL_MILESTONES = [25, 50, 75, 100]


async def _goal_milestone_alert(
    user_id: str,
    goal_id: str,
    goal_name: str,
    old_amount: float,
    new_amount: float,
    target_amount: float,
) -> None:
    """Fire push for each newly crossed milestone (25/50/75/100%)."""
    try:
        from services.push_service import send_push

        if target_amount <= 0:
            return

        old_pct = (old_amount / target_amount) * 100
        new_pct = (new_amount / target_amount) * 100

        # Fetch already-sent milestones from goal doc
        goal_doc = await db.savings_goals.find_one(
            {"goal_id": goal_id, "user_id": user_id},
            {"_id": 0, "milestone_notifications_sent": 1},
        )
        sent: list[int] = goal_doc.get("milestone_notifications_sent", []) if goal_doc else []

        newly_crossed = [
            m for m in GOAL_MILESTONES
            if m not in sent and old_pct < m <= new_pct
        ]

        for milestone in newly_crossed:
            await send_push(
                user_id=user_id,
                title="Goal Milestone 🎉",
                body=f"{goal_name} is {milestone}% complete!",
                data={"link": "/goals", "goal_id": goal_id},
                notif_type="goal_milestone",
                link="/goals",
            )
            sent.append(milestone)

        if newly_crossed:
            await db.savings_goals.update_one(
                {"goal_id": goal_id, "user_id": user_id},
                {"$set": {"milestone_notifications_sent": sent}},
            )
    except Exception:
        logger.exception("_goal_milestone_alert failed goal_id=%s", goal_id)
from services.savings_goals_service import (
    calculate_goal_progress_percentage,
    calculate_monthly_savings_recommendation,
    calculate_goal_projection,
    calculate_recent_monthly_savings_velocity,
)

router = APIRouter(prefix="/savings-goals", tags=["savings-goals"])


async def _ensure_profile_owned(profile_id: str, user_id: str):
    profile = await db.profiles.find_one(
        {"profile_id": profile_id, "user_id": user_id},
        {"_id": 0},
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")


async def _enrich_goal(
    goal: dict,
    user_id: str,
    manual_monthly_contribution: Optional[float] = None,
    monthly_velocity: Optional[float] = None,
) -> dict:
    progress_percentage = calculate_goal_progress_percentage(
        goal.get("current_amount"),
        goal.get("target_amount"),
    )
    velocity = monthly_velocity
    if velocity is None:
        velocity = await calculate_recent_monthly_savings_velocity(
            user_id,
            goal["profile_id"],
            expenses_collection=db.expenses,
        )
    projection = calculate_goal_projection(
        current_amount=goal.get("current_amount"),
        target_amount=goal.get("target_amount"),
        monthly_velocity=velocity,
        manual_monthly_contribution=manual_monthly_contribution,
    )
    monthly_recommendation = calculate_monthly_savings_recommendation(
        current_amount=goal.get("current_amount"),
        target_amount=goal.get("target_amount"),
        deadline=goal.get("deadline"),
    )
    return {
        **goal,
        "progress_percentage": progress_percentage,
        "monthly_savings_recommendation": monthly_recommendation,
        "projected_completion": projection,
    }


@router.post("", response_model=SavingsGoalResponse)
async def create_savings_goal(
    data: SavingsGoalCreate,
    current_user: dict = Depends(get_current_user),
):
    await get_accessible_profile(data.profile_id, current_user)

    goal = SavingsGoal(user_id=current_user["user_id"], **data.model_dump())
    await db.savings_goals.insert_one(goal.model_dump())
    return await _enrich_goal(goal.model_dump(), current_user["user_id"])


@router.get("", response_model=list[SavingsGoalResponse])
async def list_savings_goals(
    profile_id: Optional[str] = None,
    manual_monthly_contribution: Optional[float] = None,
    current_user: dict = Depends(get_current_user),
):
    if profile_id:
        await get_accessible_profile(profile_id, current_user)
        query: dict = {"profile_id": profile_id}
    else:
        query = {"user_id": current_user["user_id"]}

    goals = await db.savings_goals.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    profile_velocity: dict[str, float] = {}
    enriched = []
    for goal in goals:
        profile_id = goal["profile_id"]
        if profile_id not in profile_velocity:
            profile_velocity[profile_id] = await calculate_recent_monthly_savings_velocity(
                current_user["user_id"],
                profile_id,
                expenses_collection=db.expenses,
            )
        enriched.append(
            await _enrich_goal(
                goal,
                current_user["user_id"],
                manual_monthly_contribution,
                monthly_velocity=profile_velocity[profile_id],
            )
        )
    return enriched


@router.get("/{goal_id}", response_model=SavingsGoalResponse)
async def get_savings_goal(
    goal_id: str,
    manual_monthly_contribution: Optional[float] = None,
    current_user: dict = Depends(get_current_user),
):
    goal = await db.savings_goals.find_one(
        {"goal_id": goal_id, "user_id": current_user["user_id"]},
        {"_id": 0},
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    return await _enrich_goal(goal, current_user["user_id"], manual_monthly_contribution)


@router.put("/{goal_id}", response_model=SavingsGoalResponse)
async def update_savings_goal(
    goal_id: str,
    data: SavingsGoalUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await db.savings_goals.find_one(
        {"goal_id": goal_id, "user_id": current_user["user_id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Savings goal not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    target_profile_id = update_data.get("profile_id", existing["profile_id"])
    await get_accessible_profile(target_profile_id, current_user)

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated = await db.savings_goals.find_one_and_update(
        {"goal_id": goal_id, "user_id": current_user["user_id"]},
        {"$set": update_data},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )

    # Fire milestone alert if current_amount changed
    if "current_amount" in update_data:
        asyncio.create_task(
            _goal_milestone_alert(
                user_id=current_user["user_id"],
                goal_id=goal_id,
                goal_name=updated.get("name", "Your goal"),
                old_amount=float(existing.get("current_amount", 0)),
                new_amount=float(updated.get("current_amount", 0)),
                target_amount=float(updated.get("target_amount", 1)),
            )
        )

    return await _enrich_goal(updated, current_user["user_id"])


@router.delete("/{goal_id}", response_model=MessageResponse)
async def delete_savings_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.savings_goals.delete_one(
        {"goal_id": goal_id, "user_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    return {"message": "Savings goal deleted"}
