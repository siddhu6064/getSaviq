import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from database import db
from deps import get_accessible_profile, get_current_user
from models import (
    Asset,
    AssetCreate,
    AssetResponse,
    AssetUpdate,
    Liability,
    LiabilityCreate,
    LiabilityResponse,
    LiabilityUpdate,
    NetWorthProfileBreakdown,
    NetWorthResponse,
    NetWorthSnapshot,
    MessageResponse,
)

router = APIRouter(tags=["net-worth"])
logger = logging.getLogger(__name__)


# ===================== HELPERS =====================

async def _calc_net_worth_for_user(user_id: str, profile_id: Optional[str] = None):
    """Return (assets_total, liabilities_total, by_profile list) for a user."""
    asset_query: dict = {"user_id": user_id}
    liab_query: dict = {"user_id": user_id}
    if profile_id:
        asset_query["profile_id"] = profile_id
        liab_query["profile_id"] = profile_id

    assets, liabilities = await asyncio.gather(
        db.assets.find(asset_query, {"_id": 0, "profile_id": 1, "value": 1}).to_list(5000),
        db.liabilities.find(liab_query, {"_id": 0, "profile_id": 1, "balance": 1}).to_list(5000),
    )

    # Aggregate by profile
    profile_assets: dict = {}
    profile_liabilities: dict = {}

    for a in assets:
        pid = a["profile_id"]
        profile_assets[pid] = profile_assets.get(pid, 0.0) + a.get("value", 0.0)

    for l in liabilities:
        pid = l["profile_id"]
        profile_liabilities[pid] = profile_liabilities.get(pid, 0.0) + l.get("balance", 0.0)

    all_profiles = set(profile_assets.keys()) | set(profile_liabilities.keys())

    by_profile = []
    total_assets = 0.0
    total_liabilities = 0.0

    for pid in all_profiles:
        a_total = profile_assets.get(pid, 0.0)
        l_total = profile_liabilities.get(pid, 0.0)
        total_assets += a_total
        total_liabilities += l_total
        by_profile.append(NetWorthProfileBreakdown(
            profile_id=pid,
            assets_total=round(a_total, 2),
            liabilities_total=round(l_total, 2),
            net_worth=round(a_total - l_total, 2),
        ))

    return round(total_assets, 2), round(total_liabilities, 2), by_profile


# ===================== NET WORTH SUMMARY =====================

@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth(
    profile_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Current net worth: assets − liabilities, scoped by user (+ optional profile)."""
    user_id = current_user["user_id"]

    if profile_id:
        await get_accessible_profile(profile_id, current_user)

    assets_total, liabilities_total, by_profile = await _calc_net_worth_for_user(user_id, profile_id)

    return NetWorthResponse(
        assets_total=assets_total,
        liabilities_total=liabilities_total,
        net_worth=round(assets_total - liabilities_total, 2),
        by_profile=by_profile,
    )


# ===================== NET WORTH HISTORY =====================

@router.get("/net-worth/history")
async def get_net_worth_history(
    profile_id: Optional[str] = None,
    days: int = Query(180, ge=1, le=3650),
    current_user: dict = Depends(get_current_user),
):
    """Return net_worth_snapshots for trend chart."""
    user_id = current_user["user_id"]

    if profile_id:
        await get_accessible_profile(profile_id, current_user)

    cutoff = datetime.now(timezone.utc)
    from datetime import timedelta
    cutoff = cutoff - timedelta(days=days)

    query: dict = {"user_id": user_id, "date": {"$gte": cutoff}}
    if profile_id:
        query["profile_id"] = profile_id

    snapshots = await db.net_worth_snapshots.find(
        query, {"_id": 0}
    ).sort("date", 1).to_list(5000)

    return {"snapshots": snapshots}


# ===================== ASSETS CRUD =====================

@router.post("/assets", response_model=AssetResponse)
async def create_asset(data: AssetCreate, current_user: dict = Depends(get_current_user)):
    """Create a new asset."""
    user_id = current_user["user_id"]
    await get_accessible_profile(data.profile_id, current_user)

    asset = Asset(
        user_id=user_id,
        profile_id=data.profile_id,
        name=data.name,
        type=data.type,
        value=data.value,
        currency=data.currency,
    )
    await db.assets.insert_one(asset.model_dump())
    return asset.model_dump()


@router.get("/assets", response_model=list[AssetResponse])
async def list_assets(
    profile_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List assets scoped by user + optional profile."""
    if profile_id:
        await get_accessible_profile(profile_id, current_user)
        query: dict = {"profile_id": profile_id}
    else:
        query = {"user_id": current_user["user_id"]}

    assets = await db.assets.find(query, {"_id": 0}).to_list(5000)
    return assets


@router.put("/assets/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: str,
    data: AssetUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an asset."""
    user_id = current_user["user_id"]

    existing = await db.assets.find_one(
        {"asset_id": asset_id, "user_id": user_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    asset = await db.assets.find_one_and_update(
        {"asset_id": asset_id, "user_id": user_id},
        {"$set": update_data},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    return asset


@router.delete("/assets/{asset_id}", response_model=MessageResponse)
async def delete_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an asset."""
    result = await db.assets.delete_one(
        {"asset_id": asset_id, "user_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"message": "Asset deleted"}


# ===================== LIABILITIES CRUD =====================

@router.post("/liabilities", response_model=LiabilityResponse)
async def create_liability(data: LiabilityCreate, current_user: dict = Depends(get_current_user)):
    """Create a new liability."""
    user_id = current_user["user_id"]
    await get_accessible_profile(data.profile_id, current_user)

    liability = Liability(
        user_id=user_id,
        profile_id=data.profile_id,
        name=data.name,
        type=data.type,
        balance=data.balance,
        interest_rate=data.interest_rate,
        monthly_payment=data.monthly_payment,
    )
    await db.liabilities.insert_one(liability.model_dump())
    return liability.model_dump()


@router.get("/liabilities", response_model=list[LiabilityResponse])
async def list_liabilities(
    profile_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List liabilities scoped by user + optional profile."""
    if profile_id:
        await get_accessible_profile(profile_id, current_user)
        query: dict = {"profile_id": profile_id}
    else:
        query = {"user_id": current_user["user_id"]}

    liabilities = await db.liabilities.find(query, {"_id": 0}).to_list(5000)
    return liabilities


@router.put("/liabilities/{liability_id}", response_model=LiabilityResponse)
async def update_liability(
    liability_id: str,
    data: LiabilityUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a liability."""
    user_id = current_user["user_id"]

    existing = await db.liabilities.find_one(
        {"liability_id": liability_id, "user_id": user_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Liability not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    liability = await db.liabilities.find_one_and_update(
        {"liability_id": liability_id, "user_id": user_id},
        {"$set": update_data},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    return liability


@router.delete("/liabilities/{liability_id}", response_model=MessageResponse)
async def delete_liability(
    liability_id: str, current_user: dict = Depends(get_current_user)
):
    """Delete a liability."""
    result = await db.liabilities.delete_one(
        {"liability_id": liability_id, "user_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Liability not found")
    return {"message": "Liability deleted"}


# ===================== SNAPSHOT JOB =====================

async def take_net_worth_snapshots():
    """Nightly job: write one snapshot per user/profile from current assets + liabilities."""
    try:
        now = datetime.now(timezone.utc)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Get all distinct user_ids that have profiles
        user_ids = await db.profiles.distinct("user_id")
        logger.info("net_worth snapshot job: processing %d users", len(user_ids))

        for user_id in user_ids:
            profiles = await db.profiles.find(
                {"user_id": user_id}, {"_id": 0, "profile_id": 1}
            ).to_list(100)

            for profile_doc in profiles:
                profile_id = profile_doc["profile_id"]

                assets, liabilities = await asyncio.gather(
                    db.assets.find(
                        {"user_id": user_id, "profile_id": profile_id},
                        {"_id": 0, "value": 1},
                    ).to_list(5000),
                    db.liabilities.find(
                        {"user_id": user_id, "profile_id": profile_id},
                        {"_id": 0, "balance": 1},
                    ).to_list(5000),
                )

                assets_total = round(sum(a.get("value", 0.0) for a in assets), 2)
                liabilities_total = round(sum(l.get("balance", 0.0) for l in liabilities), 2)
                net_worth = round(assets_total - liabilities_total, 2)

                snapshot = NetWorthSnapshot(
                    user_id=user_id,
                    profile_id=profile_id,
                    date=today,
                    net_worth=net_worth,
                    assets_total=assets_total,
                    liabilities_total=liabilities_total,
                )

                # Upsert by (user_id, profile_id, date) to avoid duplicates on re-run
                await db.net_worth_snapshots.update_one(
                    {"user_id": user_id, "profile_id": profile_id, "date": today},
                    {"$set": snapshot.model_dump()},
                    upsert=True,
                )

        logger.info("net_worth snapshot job: complete")
    except Exception:
        logger.exception("net_worth snapshot job failed")
