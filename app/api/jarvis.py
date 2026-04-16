import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any

from app.api.user import get_current_user
from app.schemas.jarvis import JarvisChatRequest, JarvisChatResponse
from app.services.jarvis_service import jarvis_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/chat", response_model=JarvisChatResponse)
async def chat_with_jarvis(
    request: JarvisChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Speak with JARVIS.
    """
    try:
        # Convert history objects to dicts for the service
        history_dicts = [h.dict() for h in request.history] if request.history else []
        
        result = await jarvis_service.chat(
            user_id=current_user["id"],
            message=request.message,
            history=history_dicts,
            deep_think=request.deep_think
        )
        return result
    except Exception as e:
        logger.error(f"[Jarvis API] Chat error: {e}")
        raise HTTPException(status_code=500, detail="JARVIS is temporarily offline.")

@router.get("/history")
async def get_chat_history(
    current_user: dict = Depends(get_current_user),
):
    """
    Retrieve recent chat history with JARVIS (Stub for now, or pull from memory).
    """
    # In a real production app, we'd store the actual chat logs in a 'chats' collection.
    # For now, we return an empty list or pull recent jarvis_context memories.
    return {"history": []}
