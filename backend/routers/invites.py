"""
Profile invite endpoints.

POST /api/profiles/{profile_id}/invite  — owner sends invite
GET  /api/invite/accept?token=          — invitee accepts (auth optional)
POST /api/invite/decline                — invitee declines
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from deps import get_current_user
from models import (
    MessageResponse,
    ProfileMember,
    ProfileMemberCreate,
    ProfileMemberResponse,
    ProfileMemberStatus,
)
from services.email_service import send_profile_invite

logger = logging.getLogger(__name__)

router = APIRouter(tags=["invites"])

INVITE_TTL_DAYS = 7


# ── helpers ───────────────────────────────────────────────────────────────────

def _is_expired(invited_at: datetime) -> bool:
    if invited_at.tzinfo is None:
        invited_at = invited_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > invited_at + timedelta(days=INVITE_TTL_DAYS)


def _member_to_response(doc: dict) -> ProfileMemberResponse:
    return ProfileMemberResponse(
        member_id=doc["member_id"],
        profile_id=doc["profile_id"],
        invited_email=doc["invited_email"],
        role=doc["role"],
        status=doc["status"],
        invited_at=doc["invited_at"],
        accepted_at=doc.get("accepted_at"),
    )


# ── POST /profiles/{profile_id}/invite ───────────────────────────────────────

@router.post("/profiles/{profile_id}/invite", response_model=ProfileMemberResponse, status_code=201)
async def invite_to_profile(
    profile_id: str,
    data: ProfileMemberCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Invite a user by email to a shared profile.
    Only the profile owner can send invites; only shared profiles are allowed.
    """
    profile = await db.profiles.find_one(
        {"profile_id": profile_id, "user_id": current_user["user_id"]},
        {"_id": 0},
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.get("profile_type") != "shared":
        raise HTTPException(
            status_code=400,
            detail="Invites are only allowed for shared profiles",
        )

    # Prevent self-invite
    if data.email == current_user.get("email", "").strip().lower():
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    # Prevent duplicate pending/accepted invite
    existing = await db.profile_members.find_one(
        {
            "profile_id": profile_id,
            "invited_email": data.email,
            "status": {"$in": ["pending", "accepted"]},
        },
        {"_id": 0, "status": 1},
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An invite for {data.email} is already {existing['status']}",
        )

    # Check if invitee already has an account (to set invited_user_id immediately)
    invitee_user = await db.users.find_one(
        {"email": data.email}, {"_id": 0, "user_id": 1}
    )

    member = ProfileMember(
        profile_id=profile_id,
        user_id=current_user["user_id"],
        invited_user_id=invitee_user["user_id"] if invitee_user else None,
        invited_email=data.email,
    )
    await db.profile_members.insert_one(member.model_dump())
    logger.info(
        "invite created member_id=%s profile_id=%s email=%s",
        member.member_id,
        profile_id,
        data.email,
    )

    # Send email best-effort — don't fail the request if email fails
    await send_profile_invite(
        to_email=data.email,
        inviter_name=current_user.get("name", "Someone"),
        profile_name=profile.get("name", "a shared profile"),
        invite_token=member.invite_token,
    )

    return _member_to_response(member.model_dump())


# ── GET /invite/accept?token= ─────────────────────────────────────────────────

@router.get("/invite/accept", status_code=200)
async def get_invite_info(token: str = Query(...)):
    """
    Validate an invite token and return invite details.
    No auth required — used by the frontend to show the invite landing page.
    """
    member_doc = await db.profile_members.find_one(
        {"invite_token": token}, {"_id": 0}
    )
    if not member_doc:
        raise HTTPException(status_code=404, detail="Invite not found")
    if member_doc["status"] == ProfileMemberStatus.declined:
        raise HTTPException(status_code=410, detail="Invite was declined")
    if member_doc["status"] == ProfileMemberStatus.accepted:
        raise HTTPException(status_code=409, detail="Invite already accepted")
    if _is_expired(member_doc["invited_at"]):
        raise HTTPException(status_code=410, detail="Invite has expired")

    # Enrich with profile name + inviter name for display
    profile = await db.profiles.find_one(
        {"profile_id": member_doc["profile_id"]}, {"_id": 0, "name": 1}
    )
    inviter = await db.users.find_one(
        {"user_id": member_doc["user_id"]}, {"_id": 0, "name": 1}
    )

    return {
        "status": "pending",
        "invite_token": token,
        "invited_email": member_doc["invited_email"],
        "profile_id": member_doc["profile_id"],
        "profile_name": (profile or {}).get("name", "Shared Profile"),
        "inviter_name": (inviter or {}).get("name", "Someone"),
    }


@router.post("/invite/accept", status_code=200)
async def accept_invite_authenticated(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept a profile invite when the caller is already authenticated.
    Body: {"token": "<invite_token>"}
    """
    token = (body or {}).get("token", "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    member_doc = await db.profile_members.find_one(
        {"invite_token": token}, {"_id": 0}
    )
    if not member_doc:
        raise HTTPException(status_code=404, detail="Invite not found")
    if member_doc["status"] == ProfileMemberStatus.declined:
        raise HTTPException(status_code=410, detail="Invite was declined")
    if member_doc["status"] == ProfileMemberStatus.accepted:
        raise HTTPException(status_code=409, detail="Invite already accepted")
    if _is_expired(member_doc["invited_at"]):
        raise HTTPException(status_code=410, detail="Invite has expired")

    # Validate the email matches (security check)
    caller_email = current_user.get("email", "").strip().lower()
    if caller_email and caller_email != member_doc["invited_email"]:
        raise HTTPException(
            status_code=403,
            detail="This invite was not sent to your account",
        )

    now = datetime.now(timezone.utc)
    await db.profile_members.update_one(
        {"invite_token": token},
        {
            "$set": {
                "status": "accepted",
                "invited_user_id": current_user["user_id"],
                "accepted_at": now,
            }
        },
    )
    logger.info(
        "invite accepted member_id=%s user_id=%s",
        member_doc["member_id"],
        current_user["user_id"],
    )
    return {"message": "Invite accepted", "profile_id": member_doc["profile_id"]}


# ── POST /invite/decline ──────────────────────────────────────────────────────

@router.post("/invite/decline", response_model=MessageResponse)
async def decline_invite(body: dict):
    """
    Decline a profile invite.
    Body: {"token": "<invite_token>"}
    No auth required — anyone with the token can decline.
    """
    token = (body or {}).get("token", "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    member_doc = await db.profile_members.find_one(
        {"invite_token": token}, {"_id": 0, "status": 1}
    )
    if not member_doc:
        raise HTTPException(status_code=404, detail="Invite not found")
    if member_doc["status"] == ProfileMemberStatus.accepted:
        raise HTTPException(status_code=409, detail="Cannot decline an already accepted invite")

    await db.profile_members.update_one(
        {"invite_token": token},
        {"$set": {"status": "declined"}},
    )
    return {"message": "Invite declined"}
