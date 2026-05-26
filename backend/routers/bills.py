"""
Recurring Bill Management — CRUD + APScheduler reminder job.
"""
import asyncio
import calendar
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from database import db
from deps import get_accessible_profile, get_current_user
from models import (
    Bill,
    BillCreate,
    BillFromSubscriptionCreate,
    BillResponse,
    BillStatus,
    BillUpdate,
    MessageResponse,
)

router = APIRouter(tags=["bills"])
logger = logging.getLogger(__name__)


# ===================== HELPERS =====================

async def _get_owned_bill(bill_id: str, user_id: str) -> dict:
    doc = await db.bills.find_one({"bill_id": bill_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Bill not found")
    return doc


# ===================== CRUD =====================

@router.post("/bills", response_model=BillResponse, status_code=201)
async def create_bill(
    data: BillCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new recurring bill."""
    await get_accessible_profile(data.profile_id, current_user)
    bill = Bill(
        user_id=current_user["user_id"],
        profile_id=data.profile_id,
        name=data.name,
        merchant=data.merchant,
        expected_amount=data.expected_amount,
        frequency=data.frequency,
        due_day=data.due_day,
        auto_detected=data.auto_detected,
        linked_expense_ids=data.linked_expense_ids,
        status=data.status,
    )
    await db.bills.insert_one(bill.model_dump())
    logger.info("bill created bill_id=%s user_id=%s", bill.bill_id, bill.user_id)
    return bill.model_dump()


@router.get("/bills", response_model=list[BillResponse])
async def list_bills(
    profile_id: Optional[str] = None,
    status: Optional[BillStatus] = None,
    current_user: dict = Depends(get_current_user),
):
    """List bills for current user, optionally filtered by profile and/or status."""
    query: dict = {"user_id": current_user["user_id"]}
    if profile_id:
        query["profile_id"] = profile_id
    if status:
        query["status"] = status.value
    bills = await db.bills.find(query, {"_id": 0}).sort("due_day", 1).to_list(500)
    return bills


@router.put("/bills/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: str,
    data: BillUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Partially update a bill (owner only)."""
    await _get_owned_bill(bill_id, current_user["user_id"])

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated = await db.bills.find_one_and_update(
        {"bill_id": bill_id, "user_id": current_user["user_id"]},
        {"$set": update_data},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    logger.info("bill updated bill_id=%s", bill_id)
    return updated


@router.delete("/bills/{bill_id}", response_model=MessageResponse)
async def delete_bill(
    bill_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a bill (owner only)."""
    result = await db.bills.delete_one(
        {"bill_id": bill_id, "user_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    logger.info("bill deleted bill_id=%s user_id=%s", bill_id, current_user["user_id"])
    return {"message": "Bill deleted"}


@router.post("/bills/from-subscription", response_model=BillResponse, status_code=201)
async def create_bill_from_subscription(
    data: BillFromSubscriptionCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Promote a subscription to a tracked bill.
    auto_detected is forced True to signal this was derived from subscription data.
    """
    await get_accessible_profile(data.profile_id, current_user)
    bill = Bill(
        user_id=current_user["user_id"],
        profile_id=data.profile_id,
        name=data.name,
        merchant=data.merchant,
        expected_amount=data.expected_amount,
        frequency=data.frequency,
        due_day=data.due_day,
        auto_detected=True,
    )
    await db.bills.insert_one(bill.model_dump())
    logger.info(
        "bill created from subscription bill_id=%s merchant=%s",
        bill.bill_id,
        bill.merchant,
    )
    return bill.model_dump()


# ===================== APSCHEDULER JOB =====================

async def check_bill_due_reminders() -> None:
    """
    Daily 8 AM UTC job.
    For each active bill, compute how many days until next due occurrence.
    Alert (0–3 days out) once per bill per calendar day.
    Skip if bill already has a matched expense for the current cycle.
    """
    from services.push_service import send_push

    now = datetime.now(timezone.utc)
    today = now.date()

    try:
        bills = await db.bills.find({"status": "active"}, {"_id": 0}).to_list(5000)
    except Exception:
        logger.exception("check_bill_due_reminders: DB fetch failed")
        return

    for bill in bills:
        try:
            due_day: int = bill.get("due_day", 1)
            frequency: str = bill.get("frequency", "monthly")
            bill_id: str = bill["bill_id"]
            user_id: str = bill["user_id"]

            # Clamp due_day to actual days in current month
            days_in_month = calendar.monthrange(today.year, today.month)[1]
            effective_due_day = min(due_day, days_in_month)

            if frequency == "monthly":
                # Next due date: this month or next
                if today.day <= effective_due_day:
                    # Due later this month
                    next_due = today.replace(day=effective_due_day)
                else:
                    # Already passed — next month
                    nm = today.month + 1 if today.month < 12 else 1
                    ny = today.year if today.month < 12 else today.year + 1
                    days_nm = calendar.monthrange(ny, nm)[1]
                    next_due = today.replace(
                        year=ny, month=nm, day=min(due_day, days_nm)
                    )

            elif frequency == "weekly":
                # due_day treated as ISO weekday (1=Mon…7=Sun)
                target_weekday = (due_day - 1) % 7  # Python 0=Mon
                current_weekday = today.weekday()
                delta = (target_weekday - current_weekday) % 7
                if delta == 0:
                    delta = 7  # push to next week if today is the day (already fired)
                from datetime import timedelta
                next_due = today + timedelta(days=delta)

            elif frequency == "annual":
                # due_day = day-of-year (1–365)
                from datetime import timedelta
                year_start = today.replace(month=1, day=1)
                target = year_start + timedelta(days=due_day - 1)
                if target < today:
                    target = target.replace(year=target.year + 1)
                next_due = target

            else:
                continue  # unknown frequency — skip

            days_until = (next_due - today).days
            if days_until < 0 or days_until > 3:
                continue

            # Deduplicate: one alert per bill per calendar day
            day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            existing = await db.notifications.find_one(
                {
                    "user_id": user_id,
                    "type": "bill_reminder",
                    "created_at": {"$gte": day_start},
                    "body": {"$regex": re.escape(bill_id)},
                }
            )
            if existing:
                continue

            # Check if already paid this cycle (has a linked expense dated this month)
            linked_ids: list = bill.get("linked_expense_ids") or []
            if linked_ids:
                cycle_start = today.replace(day=1)
                cycle_start_dt = datetime(
                    cycle_start.year, cycle_start.month, cycle_start.day, tzinfo=timezone.utc
                )
                recent_match = await db.expenses.find_one(
                    {
                        "expense_id": {"$in": linked_ids},
                        "date": {"$gte": cycle_start_dt},
                    }
                )
                if recent_match:
                    continue  # already paid this cycle

            # Send reminder
            bill_name = bill.get("name", "Bill")
            due_label = "today" if days_until == 0 else (
                "tomorrow" if days_until == 1 else f"in {days_until} days"
            )
            amount = bill.get("expected_amount", 0)

            await send_push(
                user_id=user_id,
                title="Bill Due Soon",
                body=f"{bill_name} (${amount:,.2f}) is due {due_label} [{bill_id}]",
                data={"link": "/bills", "bill_id": bill_id},
                notif_type="bill_reminder",
                link="/bills",
            )
            logger.info(
                "bill_reminder sent bill_id=%s user_id=%s days_until=%s",
                bill_id,
                user_id,
                days_until,
            )

        except Exception:
            logger.exception(
                "check_bill_due_reminders: error processing bill_id=%s",
                bill.get("bill_id", "unknown"),
            )
