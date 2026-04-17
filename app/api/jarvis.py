import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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

@router.post("/chat/stream")
async def chat_with_jarvis_stream(
    request: JarvisChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Speak with JARVIS via streaming for real-time interaction.
    """
    try:
        history_dicts = [h.dict() for h in request.history] if request.history else []
        
        async def event_generator():
            async for token in jarvis_service.chat_stream(
                user_id=current_user["id"],
                message=request.message,
                history=history_dicts,
                deep_think=request.deep_think
            ):
                yield token

        return StreamingResponse(event_generator(), media_type="text/plain")
    except Exception as e:
        logger.error(f"[Jarvis API] Streaming output error: {e}")
        raise HTTPException(status_code=500, detail="JARVIS neural link synchronization failed.")

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
