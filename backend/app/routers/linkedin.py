import logging
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
from typing import Dict, Any, List

from starlette.concurrency import run_in_threadpool
from app.models.user import User
from app.services import ai_service
from app.middleware.auth_middleware import get_current_user
from app.rate_limiter import limiter
from app.utils.pdf import extract_pdf_text

router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn"])

logger = logging.getLogger(__name__)

class LinkedInOptimizationResponse(BaseModel):
    headline_suggestions: List[str]
    summary_rewrite: str
    experience_improvements: List[Dict[str, str]]

@router.post("/optimize", response_model=LinkedInOptimizationResponse)
@limiter.limit("10/minute")
async def optimize_linkedin(
    request: Request,
    profile_file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """
    Accepts a LinkedIn PDF, extracts the text, and returns AI-driven optimization suggestions.
    """

    profile_text = ""
    
    if not profile_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported. Please save your LinkedIn profile as a PDF.")

    try:
        content = await profile_file.read()
        profile_text = await run_in_threadpool(extract_pdf_text, content)
    except Exception:
        logger.warning("LinkedIn PDF parse failed", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to parse the PDF file.")

    if not profile_text.strip():
        raise HTTPException(status_code=400, detail="The uploaded PDF appears to be empty.")

    try:
        optimization_data = await ai_service.optimize_linkedin_profile(profile_text)
        return optimization_data
    except Exception:
        logger.exception("LinkedIn optimization failed")
        raise HTTPException(status_code=500, detail="Could not generate optimizations. Please try again.")
