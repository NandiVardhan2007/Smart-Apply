from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.auth import get_current_user
from backend.services.nvidia_service import (
    answer_job_question,
    generate_cover_letter,
    extract_skills_from_description,
    analyze_ats,
    quick_ats_precheck,
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
    job_description: Optional[str] = ""


class SkillsRequest(BaseModel):
    job_description: str


class ATSRequest(BaseModel):
    job_description: Optional[str] = None
    resume_text:     Optional[str] = None
    file_id:         Optional[str] = None


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
        letter = await generate_cover_letter(
            body.user_info, body.job_title, body.company, body.job_description or ""
        )
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
    ATS Resume Analyzer — research-backed scoring.
    Accepts resume_text OR file_id (fetched from GridFS).
    job_description is optional but strongly recommended for accurate scoring.
    """
    from backend.database import get_db, get_gridfs
    from bson import ObjectId
    import io

    resume_text = body.resume_text or ""

    if body.file_id and not resume_text:
        try:
            db      = get_db()
            gridfs  = get_gridfs()

            # Ownership check
            file_doc = await db["resumes.files"].find_one({"_id": ObjectId(body.file_id)})
            if file_doc:
                owner = file_doc.get("metadata", {}).get("user_id")
                if owner and owner != current_user["user_id"]:
                    raise HTTPException(403, detail="Access denied")

            stream    = await gridfs.open_download_stream(ObjectId(body.file_id))
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

    # Run local rule-based pre-checks first (fast, no API quota)
    local_issues = quick_ats_precheck(resume_text)

    try:
        result = await analyze_ats(resume_text, body.job_description or "")
    except RuntimeError as e:
        raise HTTPException(503, detail=f"AI service temporarily unavailable: {str(e)}. Please try again.")

    # Merge local pre-check issues into AI improvements (avoid duplicates)
    existing_tips = {imp.get("tip", "").lower() for imp in result.get("improvements", [])}
    for issue in local_issues:
        if issue["tip"].lower() not in existing_tips:
            result["improvements"].insert(0, issue)

    # Sort improvements: high → medium → low
    priority_order = {"high": 0, "medium": 1, "low": 2}
    result["improvements"] = sorted(
        result["improvements"],
        key=lambda x: priority_order.get(x.get("priority", "low"), 2)
    )

    return result
