from fastapi import Depends, HTTPException
from app.api.user import get_current_user

async def get_current_admin_user(current_user: dict = Depends(get_current_user)):
    """
    Dependency that enforces RBAC. 
    It leverages the existing get_current_user logic for authentication
    and validates the role attribute before allowing access.
    """
    # Safe defaulting if role is missing in older documents
    role = current_user.get("role", "user")
    
    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges"
        )
    
    return current_user
