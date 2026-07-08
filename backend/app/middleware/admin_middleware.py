from fastapi import Depends, HTTPException, status
from app.models.user import User
from app.middleware.auth_middleware import get_current_user

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to ensure the current user has admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
    return current_user
