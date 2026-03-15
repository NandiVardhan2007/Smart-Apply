from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.auth import get_current_user
from backend.services.nvidia_service import (
    answer_job_question,
    generate_cover_letter,
    extract_skills_from_description,
    analyze_ats,
)

router = APIRouter(prefix="/ai", tags=["ai"])


class QuestionRequest(BaseModel):
    question: str
    user_info: str
    options: Optional[list[str]] = None


class CoverLetterRequest(BaseModel):
    user_info: str
    job_title: str
    company: str


class SkillsRequest(BaseModel):
    job_description: str


class ATSRequest(BaseModel):
    job_description: Optional[str] = None
    resume_text: Optional[str] = None
    file_id: Optional[str] = None


@router.post("/answer-question")
async def answer_question(
    body: QuestionRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        answer = await answer_job_question(body.question, body.user_info, body.options)
    except RuntimeError as e:
        raise HTTPException(503, detail=f"AI service unavailable: {e}")
    return {"answer": answer}


@router.post("/cover-letter")
async def get_cover_letter(
    body: CoverLetterRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        letter = await generate_cover_letter(body.user_info, body.job_title, body.company)
    except RuntimeError as e:
        raise HTTPException(503, detail=f"AI service unavailable: {e}")
    return {"cover_letter": letter}


@router.post("/extract-skills")
async def get_skills(
    body: SkillsRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        skills = await extract_skills_from_description(body.job_description)
    except RuntimeError as e:
        raise HTTPException(503, detail=f"AI service unavailable: {e}")
    return {"skills": skills}


@router.post("/ats-analyze")
async def ats_analyze(
    body: ATSRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    ATS Resume Analyzer.
    Accepts either raw resume_text OR a file_id to fetch from GridFS.
    Job description is optional — analysis works on resume alone.
    """
    from backend.database import get_gridfs
    from bson import ObjectId
    import io

    resume_text = body.resume_text or ""

    if body.file_id and not resume_text:
        try:
            gridfs = get_gridfs()
            stream = await gridfs.open_download_stream(ObjectId(body.file_id))
            pdf_bytes = await stream.read()
            try:
                from pdfminer.high_level import extract_text as pdf_extract
                resume_text = pdf_extract(io.BytesIO(pdf_bytes))
            except Exception:
                raise HTTPException(500, detail="Could not extract text from PDF.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, detail=f"Could not load resume file: {e}")

    if not resume_text or len(resume_text.strip()) < 50:
        raise HTTPException(400, detail="Resume text is too short or empty.")

    try:
        result = await analyze_ats(resume_text, body.job_description or "")
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"AI service temporarily unavailable: {str(e)}. Please try again in a moment.",
        )
    return result
