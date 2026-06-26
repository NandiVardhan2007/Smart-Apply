from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException
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
async def ats_check(
    job_description: str = Form(""),
    resume_id: str = Form(None),
    resume_file: UploadFile = File(None),
    user: User = Depends(get_current_user)
):
    """Analyze a resume against an optional job description for ATS compatibility."""
    resume_text = ""

    if resume_id:
        try:
            resume = await Resume.get(PydanticObjectId(resume_id))
            if not resume or resume.user_id != user.id:
                raise HTTPException(status_code=404, detail="Resume not found")
            resume_text = resume.extracted_text
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
    return AtsCheckResponse(**result)

@router.post("/parse-resume", response_model=ResumeParseResponse)
async def parse_resume(
    resume_file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Parse a resume PDF and extract profile details."""
    if not resume_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    try:
        content = await resume_file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        resume_text = ""
        for page in doc:
            resume_text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
        
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the PDF. It may be an image.")

    result = await ai_service.parse_resume_for_profile(resume_text)
    return ResumeParseResponse(**result)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: User = Depends(get_current_user)):
    """Send messages to the AI career advisor chatbot."""
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    reply = await ai_service.chat_completion(messages)
    return ChatResponse(reply=reply)


@router.post("/interview/question", response_model=InterviewQuestionResponse)
async def interview_question(
    body: InterviewQuestionRequest, user: User = Depends(get_current_user)
):
    """Generate an AI interview question for the given role and difficulty."""
    result = await ai_service.generate_interview_question(body.role, body.difficulty)
    return InterviewQuestionResponse(**result)


@router.post("/interview/evaluate", response_model=InterviewEvaluateResponse)
async def interview_evaluate(
    body: InterviewEvaluateRequest, user: User = Depends(get_current_user)
):
    """Evaluate an interview answer and provide AI feedback."""
    result = await ai_service.evaluate_interview_answer(
        body.question, body.answer, body.role
    )
    return InterviewEvaluateResponse(**result)
