import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from livekit import api
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth_middleware import get_current_user
from app.models.interview_report import InterviewReport
from app.models.user import User
from app.services.email_service import send_interview_report_email

logger = logging.getLogger("interview-router")

router = APIRouter(prefix="/api/interview", tags=["Interview"])

# ─────────────────────────────────────────────
# Token endpoint
# ─────────────────────────────────────────────

class TokenRequest(BaseModel):
    room_name: str


@router.post("/token")
async def get_livekit_token(
    request: TokenRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        livekit_api_key = settings.LIVEKIT_API_KEY
        livekit_api_secret = settings.LIVEKIT_API_SECRET

        if not livekit_api_key or not livekit_api_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="LiveKit credentials are not configured on the server.",
            )

        token = api.AccessToken(livekit_api_key, livekit_api_secret)

        safe_name = current_user.full_name or "user"
        participant_identity = f"{str(current_user.id)}_{safe_name.replace(' ', '_')}"
        token.with_identity(participant_identity)
        token.with_name(safe_name)
        token.with_grants(api.VideoGrants(room_join=True, room=request.room_name))

        return {"token": token.to_jwt(), "url": settings.LIVEKIT_URL}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Internal report-save endpoint (legacy / direct)
# ─────────────────────────────────────────────

class ReportCreateRequest(BaseModel):
    user_id: str
    room_name: str
    questions_asked: List[str]
    user_replies: List[str]
    areas_for_improvement: List[str]
    weaknesses: List[str]
    telemetry_summary: Dict
    final_score: int
    overall_feedback: str
    communication_feedback: str


@router.post("/report")
async def create_report(request: ReportCreateRequest):
    """Internal endpoint to save a pre-built report directly."""
    try:
        report = InterviewReport(**request.dict())
        await report.insert()
        return {"status": "success", "id": str(report.id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Analyze endpoint — called by the worker
# Returns 202 instantly; all heavy work runs in background
# ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    user_id: str
    room_name: str
    transcript: List[Dict[str, str]]   # [{"role": "user"|"assistant", "content": "..."}]
    telemetry: Dict[str, Any]          # {"avg_confidence": float, "blink_count": int}


async def _run_llm_and_save(data: AnalyzeRequest) -> None:
    """
    Background task:
      1. Calls NVIDIA LLM to generate the report JSON
      2. Saves the report to MongoDB
      3. Looks up the user's email by user_id
      4. Sends the report email
    """
    # Hard-coded NVIDIA key as requested; also falls back to env / settings
    nvidia_api_key = (
        "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"
    )
    nvidia_model = settings.NVIDIA_MODEL

    avg_confidence = data.telemetry.get("avg_confidence", 0.0)
    blink_count = data.telemetry.get("blink_count", 0)

    transcript_text = (
        "\n".join(f"{m['role']}: {m['content']}" for m in data.transcript)
        if data.transcript
        else "No transcript available."
    )

    prompt = (
        "You are an expert technical interviewer evaluator. "
        "Based on the following interview transcript and facial telemetry metrics, "
        "generate a JSON report analyzing the candidate's performance. "
        "Specifically look for and document any grammatical or sentence formation mistakes in the candidate's speech.\n"
        f"Facial Telemetry -> Average Confidence: {avg_confidence:.2f} (0 to 1), "
        f"Total Blinks: {blink_count}\n\n"
        f"Transcript:\n{transcript_text}\n\n"
        "Output MUST be a valid JSON object matching this schema exactly:\n"
        "{\n"
        '  "questions_asked": ["question 1", "question 2"],\n'
        '  "user_replies": ["reply 1", "reply 2"],\n'
        '  "areas_for_improvement": ["area 1", "area 2"],\n'
        '  "weaknesses": ["weakness 1", "weakness 2"],\n'
        '  "telemetry_summary": {"avg_confidence": 0.85, "blink_count": 12},\n'
        '  "final_score": 85,\n'
        '  "overall_feedback": "Great job, but...",\n'
        '  "communication_feedback": "You had a few grammatical errors such as..."\n'
        "}\n"
        "Do not include Markdown formatting blocks like ```json. Return only raw JSON."
    )

    try:
        import openai as openai_client

        client = openai_client.AsyncOpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=nvidia_api_key,
        )
        logger.info(f"Calling NVIDIA LLM for room {data.room_name}...")
        response = await client.chat.completions.create(
            model=nvidia_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1024,
        )
        report_json = response.choices[0].message.content.strip()

        # Strip markdown fences if model added them anyway
        if "```" in report_json:
            report_json = report_json.split("```")[1]
            if report_json.startswith("json"):
                report_json = report_json[4:]
            report_json = report_json.strip()

        report_data = json.loads(report_json)
        report_data["user_id"] = data.user_id
        report_data["room_name"] = data.room_name

        # ── Save to DB ──
        report = InterviewReport(**report_data)
        await report.insert()
        logger.info(f"Report saved to DB for room {data.room_name}")

        # ── Send email ──
        try:
            user = await User.find_one({"_id": data.user_id})
            if not user:
                # user_id is a hex string of ObjectId
                from bson import ObjectId
                user = await User.find_one(User.id == ObjectId(data.user_id))

            if user and user.email:
                success = await send_interview_report_email(user.email, report_data)
                if success:
                    logger.info(f"Report email sent to {user.email}")
                else:
                    logger.warning(f"Failed to send report email to {user.email}")
            else:
                logger.warning(f"No user found for user_id={data.user_id}, skipping email")
        except Exception as email_err:
            logger.error(f"Email send error: {email_err}")

    except Exception as e:
        logger.error(f"LLM analysis failed for room {data.room_name}: {e}")
        import traceback
        traceback.print_exc()


@router.post("/analyze", status_code=202)
async def analyze_interview(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Called by the interview worker immediately after the session ends.
    Returns 202 instantly so the worker exits before LiveKit's shutdown timer.
    LLM analysis + DB save + email are all done in the background by FastAPI.
    """
    logger.info(f"Accepted raw interview data for room {request.room_name}, queuing analysis...")
    background_tasks.add_task(_run_llm_and_save, request)
    return {"status": "accepted", "room_name": request.room_name}


# ─────────────────────────────────────────────
# User-facing GET endpoints
# ─────────────────────────────────────────────

@router.get("/reports")
async def get_reports(current_user: User = Depends(get_current_user)):
    """Get all reports for the current user."""
    reports = await InterviewReport.find({"user_id": str(current_user.id)}).to_list()
    return reports


@router.get("/report/{room_name}")
async def get_report_by_room(
    room_name: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific report by room name."""
    report = await InterviewReport.find_one(
        {"room_name": room_name, "user_id": str(current_user.id)}
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
