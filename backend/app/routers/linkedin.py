from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Dict, Any, List

import fitz  # PyMuPDF
from app.models.user import User
from app.services import ai_service
from app.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/linkedin", tags=["LinkedIn"])

class LinkedInOptimizationResponse(BaseModel):
    headline_suggestions: List[str]
    summary_rewrite: str
    experience_improvements: List[Dict[str, str]]

@router.post("/optimize", response_model=LinkedInOptimizationResponse)
async def optimize_linkedin(
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
        doc = fitz.open(stream=content, filetype="pdf")
        for page in doc:
            profile_text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")

    if not profile_text.strip():
        raise HTTPException(status_code=400, detail="The uploaded PDF appears to be empty.")

    try:
        optimization_data = await ai_service.optimize_linkedin_profile(profile_text)
        return optimization_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating optimizations: {str(e)}")
