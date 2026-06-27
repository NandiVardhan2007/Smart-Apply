from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.routers.auth import get_current_user
from app.database import get_db_context
from app.services import ai_service
import logging

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

class PortfolioGenerateRequest(BaseModel):
    theme: str
    custom_instructions: str = ""

@router.post("/generate")
async def generate_portfolio(
    request: PortfolioGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Build user profile data object
        user_data = {
            "full_name": current_user.get("full_name", "Anonymous User"),
            "bio": current_user.get("bio", ""),
            "linkedin": current_user.get("linkedin", ""),
            "github": current_user.get("github", ""),
            "portfolio": current_user.get("portfolio", ""),
            "education": current_user.get("education", ""),
        }
        
        html_content = await ai_service.generate_portfolio_html(user_data, request.theme, request.custom_instructions)
        
        return {"html": html_content}
    except Exception as e:
        logging.error(f"Error generating portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))
