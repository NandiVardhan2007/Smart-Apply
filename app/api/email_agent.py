from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any, List

from app.api.user import get_current_user
from app.services.email_agent_service import email_agent_service

router = APIRouter()

@router.post("/scan")
async def scan_mailbox(
    mock_payload: str = Body(None, embed=True),
    current_user: dict = Depends(get_current_user)
):
    """
    Scans the connected mailbox (or mock payload) for important emails
    and returns categorized Intelligence JSON.
    """
    # In a full flow, this would call an IMAP or Google API wrapper to pull the last hours of emails.
    # Because we don't have OAuth tokens configured, we accept a mock payload in the request.
    
    input_data = mock_payload
    
    result = await email_agent_service.scan_emails(str(current_user["_id"]), input_data)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result


@router.post("/draft-reply")
async def draft_reply(
    thread_context: str = Body(...),
    user_instruction: str = Body(""),
    current_user: dict = Depends(get_current_user)
):
    """
    Generates a draft reply based on the given context and standard intelligence rules.
    """
    result = await email_agent_service.generate_draft_reply(str(current_user["_id"]), thread_context, user_instruction)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result
@router.post("/send-reply")
async def send_reply(
    thread_id: str = Body(...),
    reply_body: str = Body(...),
    subject: str = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Sends a reply to a specific email thread.
    """
    result = await email_agent_service.send_reply(
        str(current_user["_id"]), 
        thread_id, 
        reply_body, 
        subject
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result
