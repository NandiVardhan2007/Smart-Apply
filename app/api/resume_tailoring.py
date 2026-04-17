"""
Resume Tailoring API Router
Endpoints for AI-powered resume tailoring, job scraping, and history retrieval.
"""

import logging
import io
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from typing import Optional

from app.api.user import get_current_user
from app.db.mongodb import get_database
from app.schemas.resume_tailoring import (
    TailorResumeRequest,
    ScrapeJobRequest,
    ScrapeJobResponse,
)
from app.services.resume_tailoring_service import resume_tailoring_service
from app.utils.job_scraper import scrape_job_url
from app.utils.latex_compiler import compile_latex_to_pdf, LaTeXCompilationError
from bson import ObjectId

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_tailored_resume(
    request: TailorResumeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a fully tailored, ATS-friendly resume in LaTeX format.

    Accepts either a job description (text) or a job URL (auto-scraped).
    Uses the authenticated user's profile data for tailoring.
    """
    job_text = request.job_description or ""
    job_url = request.job_url

    # If a URL is provided and no description, scrape the URL first
    if job_url and not job_text.strip():
        logger.info(f"[ResumeTailor API] Scraping job URL: {job_url}")
        scraped = await scrape_job_url(job_url)
        job_text = scraped.get("description", "")

        if not job_text or len(job_text.strip()) < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract a meaningful job description from the URL. Please paste the job description manually."
            )

    # Validate we have something to work with
    if not job_text or len(job_text.strip()) < 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a job description (at least 30 characters) or a valid job URL."
        )

    try:
        user_id = str(current_user["id"])
        result = await resume_tailoring_service.tailor_and_generate(
            user_id=user_id,
            job_text=job_text,
            job_url=job_url,
            style_hint=request.style_hint
        )
        return result

    except Exception as e:
        logger.error(f"[ResumeTailor API] Generation failed for user {current_user.get('id')}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Resume generation encountered an error. Please try again."
        )


@router.post("/scrape-job", response_model=ScrapeJobResponse)
async def scrape_job(
    request: ScrapeJobRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Scrape a job posting URL and extract the job description, title, and company.
    Useful for previewing the extracted data before generating a resume.
    """
    if not request.url or not request.url.startswith("http"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid URL starting with http:// or https://"
        )

    result = await scrape_job_url(request.url)

    if not result.get("description") or len(result["description"].strip()) < 30:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract a job description from this URL. The page may require login or have dynamic content. Please paste the job description manually."
        )

    return ScrapeJobResponse(**result)


@router.get("/history")
async def get_tailoring_history(current_user: dict = Depends(get_current_user)):
    """
    Returns the user's last 5 tailored resumes (summary view).
    """
    db = get_database()
    cursor = db.tailored_resumes.find(
        {"user_id": str(current_user["id"])},
        {
            "_id": 1,
            "job_title": 1,
            "company": 1,
            "style_used": 1,
            "match_summary.tailoring_score": 1,
            "created_at": 1,
        }
    ).sort("created_at", -1).limit(5)

    history = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        # Flatten match score for the list view
        match = doc.pop("match_summary", {})
        doc["tailoring_score"] = match.get("tailoring_score", 0)
        history.append(doc)

    return {"tailored_resumes": history, "total": len(history)}


@router.get("/{tailor_id}")
async def get_tailored_resume(tailor_id: str, current_user: dict = Depends(get_current_user)):
    """
    Returns the full details of a specific tailored resume, including LaTeX code.
    """
    db = get_database()

    try:
        doc = await db.tailored_resumes.find_one({"_id": ObjectId(tailor_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format.")

    if not doc:
        raise HTTPException(status_code=404, detail="Tailored resume not found.")

    # Security: ensure ownership
    if doc.get("user_id") != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied.")

    doc["id"] = str(doc["_id"])
    del doc["_id"]

    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()

    # Remove raw JD to reduce payload
    doc.pop("job_description", None)

    return doc


@router.get("/{tailor_id}/pdf")
async def get_tailored_pdf(
    tailor_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Compiles the tailored resume's LaTeX code into a PDF and returns the binary stream.
    """
    db = get_database()

    try:
        doc = await db.tailored_resumes.find_one({"_id": ObjectId(tailor_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format.")

    if not doc:
        raise HTTPException(status_code=404, detail="Tailored resume not found.")

    # Security: ensure ownership
    if doc.get("user_id") != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied.")

    latex_code = doc.get("latex_code")
    if not latex_code:
        raise HTTPException(status_code=404, detail="LaTeX code not found for this resume.")

    try:
        # Compile LaTeX to PDF bytes
        pdf_bytes = compile_latex_to_pdf(latex_code)
        
        # Stream the PDF
        buffer = io.BytesIO(pdf_bytes)
        
        filename = f"Resume_{doc.get('company', 'Tailored')}_{doc.get('job_title', 'Role')}.pdf"
        # Sanitize filename
        filename = "".join(c for c in filename if c.isalnum() or c in (' ', '.', '_', '-')).strip()
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except LaTeXCompilationError as e:
        logger.error(f"[ResumeTailor] PDF compilation failed for {tailor_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile PDF. Technical log: {str(e)}"
        )
    except Exception as e:
        logger.error(f"[ResumeTailor] Unexpected error during PDF generation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during PDF generation."
        )
