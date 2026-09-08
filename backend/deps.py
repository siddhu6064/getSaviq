import logging
import re
from datetime import datetime, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import db

logger = logging.getLogger(__name__)

# ===================== SECURITY =====================

security = HTTPBearer(auto_error=False)

# ===================== PASSWORD HELPERS =====================


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ===================== VALIDATORS =====================

def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    return True, ""


# ===================== AUTH DEPENDENCY =====================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None,
):
    """Get current user from session token (cookie or header)"""
    token = None

    # Try to get token from cookie first
    if request:
        token = request.cookies.get("session_token")

    # Fallback to Authorization header
    if not token and credentials:
        token = credentials.credentials

    if not token:
        logger.warning(
            "unauthorized access: missing auth token",
            extra={"request_method": request.method if request else "-", "request_path": request.url.path if request else "-"},
        )
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )

    if not session:
        logger.warning(
            "unauthorized access: invalid session",
            extra={"request_method": request.method if request else "-", "request_path": request.url.path if request else "-"},
        )
        raise HTTPException(status_code=401, detail="Invalid session")

    # Check expiration
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_many({"session_token": token})
        logger.info(
            "session expired and removed",
            extra={"request_method": request.method if request else "-", "request_path": request.url.path if request else "-"},
        )
        raise HTTPException(status_code=401, detail="Session expired")

    # Get user
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )

    if not user:
        logger.warning(
            "unauthorized access: session user missing",
            extra={"request_method": request.method if request else "-", "request_path": request.url.path if request else "-"},
        )
        raise HTTPException(status_code=401, detail="User not found")

    user.pop("password_hash", None)
    return user


# ===================== PROFILE ACCESS DEPENDENCY =====================

async def get_accessible_profile(
    profile_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Return the profile document if the current user is the owner OR an
    accepted member.  Raises 404 if not found, 403 if no access.
    """
    profile = await db.profiles.find_one({"profile_id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    user_id = current_user["user_id"]

    # Owner — fast path
    if profile.get("user_id") == user_id:
        return profile

    # Accepted member check
    member = await db.profile_members.find_one(
        {
            "profile_id": profile_id,
            "invited_user_id": user_id,
            "status": "accepted",
        },
        {"_id": 0},
    )
    if member:
        return profile

    raise HTTPException(status_code=403, detail="Access denied")
