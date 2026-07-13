from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.rate_limiter import limiter
import fitz  # PyMuPDF

from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.ai import (
    AtsCheckResponse,
    ChatRequest,
    ChatResponse,
    InterviewEvaluateRequest,
    InterviewEvaluateResponse,
    InterviewQuestionRequest,
    InterviewQuestionResponse,
)
from app.services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


from app.schemas.auth import ResumeParseResponse

from beanie import PydanticObjectId
from app.models.resume import Resume

@router.post("/ats-check", response_model=AtsCheckResponse)
@limiter.limit("10/minute")
async def ats_check(
    request: Request,
    job_description: str = Form(""),
    resume_id: str = Form(None),
    resume_file: UploadFile = File(None),
    user: User = Depends(get_current_user)
):
    """Analyze a resume against an optional job description for ATS compatibility."""
    resume_text = ""

    resume = None
    if resume_id:
        try:
            resume = await Resume.get(PydanticObjectId(resume_id))
            if not resume or resume.user_id != user.id:
                raise HTTPException(status_code=404, detail="Resume not found")
            resume_text = resume.extracted_text
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid resume ID")
    elif resume_file:
        if not resume_file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
            
        try:
            content = await resume_file.read()
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                resume_text += page.get_text() + "\n"
            doc.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Either resume_id or resume_file is required")
        
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the resume.")

    result = await ai_service.analyze_resume_ats(resume_text, job_description)

    if resume is not None:
        resume.ats_score = result.get("score")
        await resume.save()

    return AtsCheckResponse(**result)

@router.post("/parse-resume", response_model=ResumeParseResponse)
@limiter.limit("10/minute")
async def parse_resume(
    request: Request,
    resume_id: str = Form(None),
    resume_file: UploadFile = File(None),
    user: User = Depends(get_current_user)
):
    """Parse a resume PDF (freshly uploaded or from the user's library) and extract profile details."""
    resume_text = ""

    if resume_id:
        try:
            resume = await Resume.get(PydanticObjectId(resume_id))
            if not resume or resume.user_id != user.id:
                raise HTTPException(status_code=404, detail="Resume not found")
            resume_text = resume.extracted_text
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid resume ID")
    elif resume_file:
        if not resume_file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        try:
            content = await resume_file.read()
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                resume_text += page.get_text() + "\n"
            doc.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Either resume_id or resume_file is required")

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the PDF. It may be an image.")

    result = await ai_service.parse_resume_for_profile(resume_text)
    return ResumeParseResponse(**result)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, body: ChatRequest, user: User = Depends(get_current_user)):
    """Send messages to the AI career advisor chatbot (non-streaming)."""
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    reply = await ai_service.chat_completion(messages)
    return ChatResponse(reply=reply)


@router.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(request: Request, body: ChatRequest, user: User = Depends(get_current_user)):
    """Stream the chatbot reply as plain-text chunks for lower perceived latency.

    The client reads the response body incrementally and appends text as it
    arrives. If the upstream model fails mid-stream we stop sending; the client
    falls back to the non-streaming /chat endpoint on any error."""
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    async def token_generator():
        try:
            async for delta in ai_service.chat_completion_stream(messages):
                yield delta
        except Exception:
            # Nothing further to send; the client will detect the truncated
            # stream (or an empty body) and retry the non-streaming endpoint.
            return

    return StreamingResponse(
        token_generator(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@router.post("/interview/question", response_model=InterviewQuestionResponse)
@limiter.limit("10/minute")
async def interview_question(
    request: Request, body: InterviewQuestionRequest, user: User = Depends(get_current_user)
):
    """Generate an AI interview question for the given role and difficulty."""
    result = await ai_service.generate_interview_question(body.role, body.difficulty)
    return InterviewQuestionResponse(**result)


@router.post("/interview/evaluate", response_model=InterviewEvaluateResponse)
@limiter.limit("10/minute")
async def interview_evaluate(
    request: Request, body: InterviewEvaluateRequest, user: User = Depends(get_current_user)
):
    """Evaluate an interview answer and provide AI feedback."""
    result = await ai_service.evaluate_interview_answer(
        body.question, body.answer, body.role
    )
    return InterviewEvaluateResponse(**result)
