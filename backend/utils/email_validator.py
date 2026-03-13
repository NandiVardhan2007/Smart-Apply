"""
email_validator.py
Async helper to validate email domains — blocks disposable/throwaway addresses.
"""

import asyncio
from backend.config import DISPOSABLE_DOMAINS


async def validate_email_domain(email: str) -> tuple[bool, str]:
    """
    Validate that an email address is not from a known disposable domain.

    Returns:
        (True, "")          — email is acceptable
        (False, "reason")   — email should be rejected, reason included
    """
    if not email or "@" not in email:
        return False, "Invalid email address format."

    domain = email.split("@")[-1].strip().lower()

    if not domain or "." not in domain:
        return False, "Invalid email domain."

    if domain in DISPOSABLE_DOMAINS:
        return False, (
            f"Disposable or temporary email addresses are not allowed. "
            f"Please use a permanent email address."
        )

    return True, ""
