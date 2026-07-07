import json
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from app.rate_limiter import limiter

from app.config import settings
from app.middleware.auth_middleware import get_current_user
from app.models.interview_report import InterviewReport
from app.models.user import User
from app.services.email_service import send_interview_report_email
from app.services.auth_service import decode_access_token

import openai

logger = logging.getLogger("interview-router")

router = APIRouter(prefix="/api/interview", tags=["Interview"])

# ─────────────────────────────────────────────
# Real-time Chat WebSocket
# ─────────────────────────────────────────────

@router.websocket("/ws/chat")
async def interview_chat_ws(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return
        
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    email = payload.get("sub")
    user = await User.find_one(User.email == email)
    if not user:
        await websocket.close(code=1008, reason="User not found")
        return

    await websocket.accept()
    
    # Initialize Groq client
    groq_api_key = settings.GROQ_API_KEY
    if not groq_api_key:
        logger.error("GROQ_API_KEY is not configured.")
        await websocket.close(code=1011, reason="Groq API key missing")
        return
        
    client = openai.AsyncOpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=groq_api_key,
    )
    
    import random
    topics = [
        "React & Frontend",
        "Python & Backend",
        "System Design & Scalability",
        "Databases & SQL",
        "Data Structures & Algorithms",
        "DevOps, Docker & Cloud",
        "JavaScript & TypeScript"
    ]
    random_topic = random.choice(topics)
    
    system_prompt = (
        "You are an expert technical interviewer named Ryan. "
        f"For this session, kick off the interview by focusing on {random_topic}. Do not mention that you randomly picked it, just naturally start asking an interesting question about it. "
        "If the user states they don't know the topic or asks to switch, you MUST acknowledge it gracefully, stop asking about that topic, and seamlessly switch to a different software engineering topic. "
        "Do not repeat the same question. Adapt to the user's responses and skill level. "
        "Keep your responses extremely concise (1-2 sentences max) since they will be spoken aloud via text-to-speech. "
        "Ask technical questions, wait for the user to answer, and then provide brief feedback before moving on to the next question. "
        "If you want the user to write code, you MUST append the exact string [OPEN_EDITOR] at the very end of your response. "
        "Be friendly but professional."
    )
    
    messages = [{"role": "system", "content": system_prompt}]
    
    try:
        while True:
            data = await websocket.receive_text()
            user_msg = json.loads(data)
            
            # Add user message to history
            messages.append({"role": "user", "content": user_msg["text"]})
            
            # Call Groq LLM
            response = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.7,
                max_tokens=256,
            )
            
            ai_text = response.choices[0].message.content.strip()
            messages.append({"role": "assistant", "content": ai_text})
            
            # Send response back to browser
            await websocket.send_json({"text": ai_text})
            
    except WebSocketDisconnect:
        logger.info("Client disconnected from chat WebSocket.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close(code=1011)
        except:
            pass

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
@limiter.limit("10/minute")
async def create_report(request: Request, body: ReportCreateRequest, current_user: User = Depends(get_current_user)):
    """Internal endpoint to save a pre-built report directly."""
    try:
        if body.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized")
        report = InterviewReport(**body.model_dump())
        await report.insert()
        return {"status": "success", "id": str(report.id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Analyze endpoint — called by the frontend when interview finishes
# ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    user_id: str
    room_name: str
    transcript: List[Dict[str, str]]   # [{"role": "user"|"assistant", "content": "..."}]
    telemetry: Dict[str, Any]          # {"avg_confidence": float, "blink_count": int}

async def _run_llm_and_save(data: AnalyzeRequest) -> None:
    nvidia_api_key = settings.NVIDIA_API_KEY
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
        client = openai.AsyncOpenAI(
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

        if "```" in report_json:
            report_json = report_json.split("```")[1]
            if report_json.startswith("json"):
                report_json = report_json[4:]
            report_json = report_json.strip()

        report_data = json.loads(report_json)
        report_data["user_id"] = data.user_id
        report_data["room_name"] = data.room_name

        report = InterviewReport(**report_data)
        await report.insert()
        logger.info(f"Report saved to DB for room {data.room_name}")

        try:
            from bson import ObjectId
            user = await User.find_one(User.id == ObjectId(data.user_id))

            if user and user.email:
                success = await send_interview_report_email(user.email, report_data)
                if success:
                    logger.info(f"Report email sent to {user.email}")
                else:
                    logger.warning(f"Failed to send report email to {user.email}")
        except Exception as email_err:
            logger.error(f"Email send error: {email_err}")

    except Exception as e:
        logger.error(f"LLM analysis failed for room {data.room_name}: {e}")
        import traceback
        traceback.print_exc()

@router.post("/analyze", status_code=202)
@limiter.limit("5/minute")
async def analyze_interview(request: Request, body: AnalyzeRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    if body.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    logger.info(f"Accepted raw interview data for room {body.room_name}, queuing analysis...")
    background_tasks.add_task(_run_llm_and_save, body)
    return {"status": "accepted", "room_name": body.room_name}

# ─────────────────────────────────────────────
# User-facing GET endpoints
# ─────────────────────────────────────────────

@router.get("/reports")
async def get_reports(current_user: User = Depends(get_current_user)):
    reports = await InterviewReport.find({"user_id": str(current_user.id)}).to_list()
    return reports

@router.get("/report/{room_name}")
async def get_report_by_room(
    room_name: str,
    current_user: User = Depends(get_current_user),
):
    report = await InterviewReport.find_one(
        {"room_name": room_name, "user_id": str(current_user.id)}
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
