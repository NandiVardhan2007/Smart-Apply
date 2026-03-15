"""
email_validator.py
Async helper to validate email domains — blocks disposable/throwaway addresses.
"""

from backend.config import DISPOSABLE_DOMAINS


async def validate_email_domain(email: str) -> tuple[bool, str]:
    if not email or "@" not in email:
        return False, "Invalid email address format."

    domain = email.split("@")[-1].strip().lower()

    if not domain or "." not in domain:
        return False, "Invalid email domain."

    if domain in DISPOSABLE_DOMAINS:
        return False, (
            "Disposable or temporary email addresses are not allowed. "
            "Please use a permanent email address."
        )

    return True, ""
