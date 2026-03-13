from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.auth import get_current_user
from backend.services.openrouter_service import (
    answer_job_question,
    generate_cover_letter,
    extract_skills_from_description,
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


@router.post("/answer-question")
async def answer_question(body: QuestionRequest, current_user: dict = Depends(get_current_user)):
    answer = await answer_job_question(body.question, body.user_info, body.options)
    return {"answer": answer}


@router.post("/cover-letter")
async def get_cover_letter(body: CoverLetterRequest, current_user: dict = Depends(get_current_user)):
    letter = await generate_cover_letter(body.user_info, body.job_title, body.company)
    return {"cover_letter": letter}


@router.post("/extract-skills")
async def get_skills(body: SkillsRequest, current_user: dict = Depends(get_current_user)):
    skills = await extract_skills_from_description(body.job_description)
    return {"skills": skills}
