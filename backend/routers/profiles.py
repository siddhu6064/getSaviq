from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from database import db
from deps import get_current_user
from models import (
    MessageResponse,
    Profile,
    ProfileCreate,
    ProfileUpdate,
    ProfileWithMembers,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _infer_profile_type(name: str) -> str:
    normalized = (name or "").strip().lower()
    if normalized == "business":
        return "business"
    if normalized == "shared":
        return "shared"
    return "personal"


async def _enrich_profile(profile: dict, caller_user_id: str) -> dict:
    """Add caller_role + members list to a profile dict."""
    if not profile.get("profile_type"):
        profile["profile_type"] = _infer_profile_type(profile.get("name", ""))

    is_owner = profile.get("user_id") == caller_user_id
    profile["caller_role"] = "owner" if is_owner else "member"

    raw_members = await db.profile_members.find(
        {"profile_id": profile["profile_id"]},
        {"_id": 0, "member_id": 1, "invited_email": 1, "role": 1, "status": 1},
    ).to_list(200)
    profile["members"] = [
        {
            "member_id": m["member_id"],
            "invited_email": m["invited_email"],
            "role": m["role"],
            "status": m["status"],
        }
        for m in raw_members
    ]
    return profile


@router.get("", response_model=list[ProfileWithMembers])
async def get_profiles(current_user: dict = Depends(get_current_user)):
    """Get all profiles accessible to current user (owned + member)."""
    user_id = current_user["user_id"]

    # Owned profiles
    owned = await db.profiles.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)

    # Profiles where user is an accepted member
    memberships = await db.profile_members.find(
        {"invited_user_id": user_id, "status": "accepted"},
        {"_id": 0, "profile_id": 1},
    ).to_list(100)
    member_profile_ids = {m["profile_id"] for m in memberships}

    # Exclude owned ones already in the list
    owned_ids = {p["profile_id"] for p in owned}
    member_profile_ids -= owned_ids

    member_profiles: list[dict] = []
    for pid in member_profile_ids:
        doc = await db.profiles.find_one({"profile_id": pid}, {"_id": 0})
        if doc:
            member_profiles.append(doc)

    all_profiles = owned + member_profiles

    result = []
    for p in all_profiles:
        result.append(await _enrich_profile(p, user_id))
    return result


@router.post("", response_model=Profile)
async def create_profile(data: ProfileCreate, current_user: dict = Depends(get_current_user)):
    """Create a new profile"""
    normalized_name = data.name.strip().lower()
    existing_profiles = await db.profiles.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "name": 1},
    ).to_list(200)
    if any((p.get("name") or "").strip().lower() == normalized_name for p in existing_profiles):
        raise HTTPException(status_code=409, detail="Profile name already exists")

    profile = Profile(
        user_id=current_user["user_id"],
        name=data.name,
        profile_type=data.profile_type,
    )
    profile_doc = profile.model_dump()
    profile_doc["name_normalized"] = normalized_name
    try:
        await db.profiles.insert_one(profile_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Profile name already exists")
    return profile_doc


@router.put("/{profile_id}", response_model=Profile)
async def update_profile(profile_id: str, data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update a profile"""
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    if "name" in update_data and update_data["name"] is not None:
        update_data["name_normalized"] = update_data["name"].strip().lower()

    result = await db.profiles.find_one_and_update(
        {"profile_id": profile_id, "user_id": current_user["user_id"]},
        {"$set": update_data},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result


@router.delete("/{profile_id}", response_model=MessageResponse)
async def delete_profile(profile_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a profile (cannot delete default profiles)"""
    profile = await db.profiles.find_one(
        {"profile_id": profile_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile_type = profile.get("profile_type") or _infer_profile_type(profile.get("name", ""))
    normalized_name = (profile.get("name") or "").strip().lower()
    inferred_default_name = normalized_name in {"personal", "business"}
    is_default_profile = bool(profile.get("is_default")) or (
        profile.get("is_default") is None and inferred_default_name
    )
    if is_default_profile and profile_type in ["personal", "business"]:
        raise HTTPException(status_code=400, detail="Cannot delete default profiles")

    expense_ref = await db.expenses.find_one(
        {"user_id": current_user["user_id"], "profile_id": profile_id},
        {"_id": 0, "expense_id": 1},
    )
    budget_ref = await db.budgets.find_one(
        {"user_id": current_user["user_id"], "profile_id": profile_id},
        {"_id": 0, "budget_id": 1},
    )
    if expense_ref or budget_ref:
        raise HTTPException(status_code=409, detail="Profile is referenced by existing expenses or budgets")

    await db.profiles.delete_one({"profile_id": profile_id, "user_id": current_user["user_id"]})
    # Clean up member records for this profile
    await db.profile_members.delete_many({"profile_id": profile_id})
    return {"message": "Profile deleted"}


@router.delete("/{profile_id}/members/{member_id}", response_model=MessageResponse)
async def remove_profile_member(
    profile_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a member from a shared profile. Only the owner can do this."""
    profile = await db.profiles.find_one(
        {"profile_id": profile_id, "user_id": current_user["user_id"]},
        {"_id": 0, "profile_id": 1},
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found or not owner")

    result = await db.profile_members.delete_one(
        {"member_id": member_id, "profile_id": profile_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member removed"}
