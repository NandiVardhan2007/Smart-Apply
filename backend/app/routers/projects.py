from typing import Any, Dict, List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from app.rate_limiter import limiter
from pydantic import BaseModel

from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.services import ai_service

router = APIRouter(prefix="/api/projects", tags=["projects"])

logger = logging.getLogger(__name__)

class ProjectRequest(BaseModel):
    skills: str
    time_commitment: str
    interests: str

class RoadmapRequest(BaseModel):
    project_details: Dict[str, Any]
    preferences: Optional[Dict[str, str]] = None

@router.post("/recommend")
@limiter.limit("5/minute")
async def recommend_projects(
    request: Request, body: ProjectRequest, current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Suggest projects based on user input."""
    projects = await ai_service.suggest_projects(
        skills=body.skills,
        time_commitment=body.time_commitment,
        interests=body.interests,
    )
    # An empty list here means the model call or JSON parse failed (the service
    # returns [] as its fallback). Surface it as an outage instead of returning
    # an empty 200 that the UI can't distinguish from "no suggestions".
    if not projects:
        logger.warning("Project suggestions returned empty fallback for user %s", current_user.id)
        raise HTTPException(status_code=503, detail="Couldn't generate project ideas right now. Please try again.")
    return projects

@router.post("/roadmap")
@limiter.limit("5/minute")
async def generate_roadmap(
    request: Request, body: RoadmapRequest, current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Generate a step-by-step roadmap for a selected project."""
    roadmap = await ai_service.generate_project_roadmap(
        project_details=body.project_details,
        preferences=body.preferences or {}
    )
    if not roadmap.get("phases"):
        logger.warning("Roadmap returned empty fallback for user %s", current_user.id)
        raise HTTPException(status_code=503, detail="Couldn't generate a roadmap right now. Please try again.")
    return roadmap
