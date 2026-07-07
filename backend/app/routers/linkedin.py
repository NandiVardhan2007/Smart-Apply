from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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
    profile_url: str = Form(None),
    profile_file: UploadFile = File(None),
    user: User = Depends(get_current_user)
):
    """
    Accepts a LinkedIn URL or a PDF, extracts the text/data, and returns AI-driven optimization suggestions.
    """
    if not profile_url and not profile_file:
        raise HTTPException(status_code=400, detail="Please provide either a LinkedIn URL or a PDF file.")

    profile_text = ""
    
    if profile_url:
        import httpx
        from app.config import settings
        
        # We will use the 'Fresh Linkedin Profile Data' API as the default
        api_url = "https://fresh-linkedin-profile-data.p.rapidapi.com/get-linkedin-profile"
        querystring = {"linkedin_url": profile_url}
        
        api_key = settings.RAPIDAPI_KEY.strip() if settings.RAPIDAPI_KEY else "fa07d89f58msh04e859394cc9d75p191797jsn14a1d0492bd2"
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "fresh-linkedin-profile-data.p.rapidapi.com"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers, params=querystring)
                response.raise_for_status()
                data = response.json()
                
                # Convert the JSON profile data into a readable string for the AI
                import json
                profile_text = json.dumps(data.get("data", data), indent=2)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=400, detail=f"RapidAPI HTTP Error: {e.response.status_code}. Make sure you are subscribed to the 'Fresh Linkedin Profile Data' API.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch profile from URL: {str(e)}")

    elif profile_file:
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
