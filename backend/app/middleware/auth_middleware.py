from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.user import User
from app.services.auth_service import decode_access_token

security = HTTPBearer()


from firebase_admin import auth

async def get_current_user(request: Request) -> User:
    """Dependency that extracts and validates the JWT from Authorization header using Firebase."""
    auth_header = request.headers.get("authorization", "")
    token = auth_header.removeprefix("Bearer ").strip() or None

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decoded_token = auth.verify_id_token(token)
        email = decoded_token.get("email")
        uid = decoded_token.get("uid")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not email and not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    if email:
        user = await User.find_one(User.email == email)
    else:
        # Fallback for custom tokens that might only have uid
        from beanie import PydanticObjectId
        try:
            user = await User.get(PydanticObjectId(uid))
        except:
            user = None

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_session_id(request: Request) -> Optional[str]:
    """Extract the X-Session-ID header for WebSocket event routing."""
    return request.headers.get("x-session-id")

