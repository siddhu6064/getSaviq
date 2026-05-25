"""
Email delivery via Resend API (https://resend.com).
Uses httpx async client — same dependency already used by push_service.py.
"""
import logging
from typing import Optional

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"
FROM_ADDRESS = "SAVIQ <noreply@saviq.app>"


async def send_profile_invite(
    *,
    to_email: str,
    inviter_name: str,
    profile_name: str,
    invite_token: str,
    app_url: Optional[str] = None,
) -> bool:
    """
    Send a profile-invite email via Resend.
    Returns True on success, False on failure (never raises — caller decides severity).
    """
    settings = get_settings()
    api_key = settings.RESEND_API_KEY
    if not api_key:
        logger.warning("RESEND_API_KEY not set — skipping invite email to %s", to_email)
        return False

    base_url = app_url or settings.WEB_URL or settings.APP_URL or "http://localhost:5173"
    accept_url = f"{base_url}/invite/accept?token={invite_token}"
    decline_url = f"{base_url}/invite/decline?token={invite_token}"

    html_body = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
      <h2 style="color:#6366f1;margin-bottom:8px">You're invited to join a shared profile</h2>
      <p><strong>{inviter_name}</strong> has invited you to collaborate on the
         <strong>{profile_name}</strong> profile in SAVIQ.</p>
      <p>As a member you'll be able to view and add transactions to this profile.</p>
      <div style="margin:32px 0;display:flex;gap:12px">
        <a href="{accept_url}"
           style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600">
          Accept Invite
        </a>
        &nbsp;&nbsp;
        <a href="{decline_url}"
           style="background:#f3f4f6;color:#374151;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600">
          Decline
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px">
        This invite link expires in 7 days. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
    """

    payload = {
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": f"{inviter_name} invited you to join {profile_name} on SAVIQ",
        "html": html_body,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_SEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
        if resp.status_code in (200, 201):
            logger.info("Invite email sent to %s (token=%s)", to_email, invite_token[:8])
            return True
        logger.warning(
            "Resend returned %s for invite to %s: %s",
            resp.status_code,
            to_email,
            resp.text[:200],
        )
        return False
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send invite email to %s: %s", to_email, exc)
        return False
