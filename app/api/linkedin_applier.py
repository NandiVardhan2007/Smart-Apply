"""
LinkedIn Auto Applier API Router
Handles AI-powered job search, application Q&A, and tracking.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse
from typing import Optional, Dict, Any, List

from app.api.user import get_current_user
from app.schemas.linkedin_applier import (
    SearchTermRequest,
    SearchTermResult,
    AnswerQuestionRequest,
    AnswerQuestionResponse,
    SaveAnswerRequest,
    ApplicationLogCreate,
)
from app.services.linkedin_applier_service import linkedin_applier_service
from app.services.engine_service import engine_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/search-terms", response_model=SearchTermResult)
async def generate_search_terms(
    request: SearchTermRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate AI-powered LinkedIn job search queries, keywords, and filters
    based on the user's resume, skills, and preferences.
    """
    try:
        result = await linkedin_applier_service.generate_search_terms(
            user_id=current_user["id"],
            resume_text=request.resume_text,
            skills=request.skills,
            experience=request.experience,
            education=request.education,
            location=request.location,
            job_preferences=request.job_preferences,
        )
        return result
    except Exception as e:
        logger.error(f"[LinkedIn Applier API] Search term generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate search terms: {str(e)}")


@router.post("/answer-question", response_model=AnswerQuestionResponse)
async def answer_application_question(
    request: AnswerQuestionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Use AI + memory to answer a LinkedIn application question.
    Returns the answer with a confidence score.
    If confidence is low, needs_user_input will be True.
    """
    try:
        result = await linkedin_applier_service.answer_question(
            user_id=current_user["id"],
            question=request.question,
            question_type=request.question_type or "text",
            options=request.options,
            job_title=request.job_title,
            company_name=request.company_name,
            job_description=request.job_description,
        )
        return result
    except Exception as e:
        logger.error(f"[LinkedIn Applier API] Question answering error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")


@router.post("/save-answer", status_code=status.HTTP_201_CREATED)
async def save_answer(
    request: SaveAnswerRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Save a user-provided or confirmed answer to memory for future reuse.
    """
    try:
        result = await linkedin_applier_service.save_answer_to_memory(
            user_id=current_user["id"],
            question=request.question,
            answer=request.answer,
            job_title=request.job_title,
            company_name=request.company_name,
            question_type=request.question_type or "text",
        )
        return {"message": "Answer saved successfully", "memory_id": result.get("id")}
    except Exception as e:
        logger.error(f"[LinkedIn Applier API] Save answer error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save answer: {str(e)}")


@router.post("/log-application", status_code=status.HTTP_201_CREATED)
async def log_application(
    request: ApplicationLogCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Log a LinkedIn job application attempt (applied, skipped, failed, paused).
    """
    try:
        result = await linkedin_applier_service.log_application(
            user_id=current_user["id"],
            job_title=request.job_title,
            company_name=request.company_name,
            job_url=request.job_url,
            status=request.status,
            notes=request.notes,
            questions_answered=request.questions_answered,
            questions_manual=request.questions_manual,
        )
        return result
    except Exception as e:
        logger.error(f"[LinkedIn Applier API] Log application error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log application: {str(e)}")


@router.get("/history")
async def get_application_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """
    Get the user's LinkedIn auto-apply application history.
    """
    apps = await linkedin_applier_service.get_application_history(
        current_user["id"], limit
    )
    return {"applications": apps, "total": len(apps)}


@router.get("/stats")
async def get_session_stats(
    current_user: dict = Depends(get_current_user),
):
    """
    Get today's application stats (applied count, total, etc).
    """
    stats = await linkedin_applier_service.get_session_stats(current_user["id"])
    return stats


@router.get("/saved-answers")
async def get_saved_answers(
    current_user: dict = Depends(get_current_user),
):
    """
    Get all saved LinkedIn Q&A answers from the user's memory.
    """
    from app.services.memory_service import memory_service

    memories = await memory_service.get_memories(
        current_user["id"], "linkedin_qa"
    )

    answers = []
    for mem in memories:
        answers.append({
            "id": mem.get("id"),
            "question": mem.get("metadata", {}).get("original_question", mem.get("key", "")),
            "answer": mem.get("content", ""),
            "question_type": mem.get("metadata", {}).get("question_type", "text"),
            "saved_at": mem.get("metadata", {}).get("saved_at", ""),
        })

    return {"answers": answers, "total": len(answers)}


@router.post("/report-error")
async def report_automation_error(
    request: dict,  # Using dict for flexibility with screenshot data
    current_user: dict = Depends(get_current_user),
):
    """
    Report an automation failure with logs and optional screenshot.
    Emails the report to the admin.
    """
    try:
        from app.services.email import email_service
        
        # Extract data from request
        error_msg = request.get("error_message", "Unknown error")
        job_title = request.get("job_title", "Unknown")
        job_url = request.get("job_url", "Unknown")
        action = request.get("action", "Unknown")
        stack_trace = request.get("stack_trace", "")
        screenshot_base64 = request.get("screenshot_base64")
        webview_state = request.get("webview_state", {})

        # Log with user info
        user_email = current_user.get("email", "Unknown User")
        
        # Build email content
        subject = f"🚨 LinkedIn Automation Failure: {job_title}"
        
        body = f"""
        <h3>Automation Failure Report</h3>
        <p><b>User:</b> {user_email}</p>
        <p><b>Job:</b> {job_title}</p>
        <p><b>URL:</b> {job_url}</p>
        <p><b>Action:</b> {action}</p>
        <p><b>Error:</b> {error_msg}</p>
        <hr>
        <h4>WebView State:</h4>
        <pre>{webview_state}</pre>
        <hr>
        <h4>Stack Trace:</h4>
        <pre>{stack_trace}</pre>
        """

        # Attachments
        attachments = []
        if screenshot_base64:
            attachments.append({
                "filename": f"failure_screenshot_{int(datetime.now().timestamp())}.png",
                "content": screenshot_base64,
                "content_type": "image/png"
            })

        # Send email to admin
        await email_service.send_email(
            to_email="kovvurinandivardhanreddy2007@gmail.com",
            subject=subject,
            body=body,
            is_html=True,
            attachments=attachments
        )

        return {"status": "success", "message": "Error report sent to admin"}
    except Exception as e:
        logger.error(f"[LinkedIn Applier API] Error reporting failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send error report: {str(e)}")

# ── OTA Sandbox Engine ───────────────────────────────────────────────

@router.get("/engine/latest", response_class=PlainTextResponse)
async def get_latest_engine_script(
    current_user: dict = Depends(get_current_user),
):
    """
    Returns the latest, auto-healed JavaScript automation engine payload.
    Served as plain text for direct injection into the Flutter WebView.
    """
    try:
        script = await engine_service.get_latest_script()
        return script
    except Exception as e:
        logger.error(f"[Engine Fetch] {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch engine")

@router.post("/engine/heal")
async def heal_engine_script(
    request: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Triggered by the Flutter app when the JS engine encounters a DOM error.
    The AI sandbox analyzes the DOM string and auto-patches the Engine script in MongoDB.
    """
    error_msg = request.get("error_message", "Unknown DOM mismatch")
    html_snapshot = request.get("html_snapshot", "")
    
    if not html_snapshot:
        raise HTTPException(status_code=400, detail="HTML snapshot is required for healing.")
        
    try:
        # We process healing inline, or we could dispatch it as a background task.
        # But Flutter wants to know when it's done so it can reload.
        new_script_version = await engine_service.auto_heal_script(error_msg, html_snapshot)
        return {"status": "success", "message": "Script healed and updated OTA."}
    except Exception as e:
        logger.error(f"[Engine Heal] {e}")
        raise HTTPException(status_code=500, detail="Failed to heal script")

