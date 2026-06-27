from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.services import ai_service
import logging

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

class PortfolioGenerateRequest(BaseModel):
    theme: str
    custom_instructions: str = ""

@router.post("/generate")
async def generate_portfolio(
    request: PortfolioGenerateRequest,
    user: User = Depends(get_current_user)
):
    try:
        # Build user profile data object
        resume = await Resume.find_one(
            Resume.user_id == user.id,
            Resume.is_primary == True
        )
        extracted_text = resume.extracted_text if resume else ""

        user_data = {
            "full_name": user.full_name or "Anonymous User",
            "bio": user.bio or "",
            "linkedin": user.linkedin_url or "",
            "github": user.github_url or "",
            "portfolio": user.portfolio_url or "",
            "education": user.education or "",
            "extracted_text": extracted_text,
        }
        
        html_content = await ai_service.generate_portfolio_html(user_data, request.theme, request.custom_instructions)
        
        return {"html": html_content}
    except Exception as e:
        logging.error(f"Error generating portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

