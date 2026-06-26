from typing import Dict, List, Optional

from pydantic import BaseModel


class AtsCheckRequest(BaseModel):
    resume_text: str
    job_description: str


class AtsCheckResponse(BaseModel):
    score: int = 0
    matched_keywords: List[str] = []
    missing_keywords: List[str] = []
    suggestions: List[str] = []


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class ChatResponse(BaseModel):
    reply: str


class InterviewQuestionRequest(BaseModel):
    role: str
    difficulty: str  # "easy", "medium", "hard"


class InterviewQuestionResponse(BaseModel):
    question: str
    category: str = ""
    tips: str = ""


class InterviewEvaluateRequest(BaseModel):
    question: str
    answer: str
    role: str


class InterviewEvaluateResponse(BaseModel):
    score: int = 0
    strengths: List[str] = []
    weaknesses: List[str] = []
    improved_answer: str = ""
