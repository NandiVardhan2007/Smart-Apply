import os
from fastapi import APIRouter, Depends, HTTPException
from livekit import api
from app.middleware.auth_middleware import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/livekit", tags=["LiveKit"])

@router.get("/token")
async def get_livekit_token(theme: str = "HR", current_user: User = Depends(get_current_user)):
    """
    Generate an access token for LiveKit to join a room.
    """
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not livekit_api_key or not livekit_api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials are not configured on the server")

    # The room name will be unique per user for their interview and includes the theme
    room_name = f"interview-{current_user.id}-{theme}"
    participant_identity = f"user-{current_user.id}"
    participant_name = current_user.full_name or "Candidate"

    try:
        # Create an access token for the user
        token = api.AccessToken(livekit_api_key, livekit_api_secret) \
            .with_identity(participant_identity) \
            .with_name(participant_name) \
            .with_grants(api.VideoGrants(
                room_join=True,
                room=room_name,
            ))
        
        return {"token": token.to_jwt(), "room_name": room_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate LiveKit token: {str(e)}")
