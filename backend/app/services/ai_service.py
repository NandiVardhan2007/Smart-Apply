import json
import time
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
import openai

from app.config import settings
from app.models.api_metrics import APILog

_client: Optional[AsyncOpenAI] = None



def _parse_llm_json(content: str, fallback: Any) -> Any:
    """Safely parse JSON from LLM output, handling markdown fences and extraneous text."""
    if not content:
        return fallback
    content = content.strip()
    
    if content.startswith("```"):
        lines = content.split("\n")
        if len(lines) > 1:
            content = "\n".join(lines[1:])
        else:
            content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()
    
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
        
    try:
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            return json.loads(content[start_idx:end_idx+1])
            
        start_idx = content.find('[')
        end_idx = content.rfind(']')
        if start_idx != -1 and end_idx != -1:
            return json.loads(content[start_idx:end_idx+1])
    except Exception:
        pass
        
    return fallback

def _get_client() -> AsyncOpenAI:
    """Lazy-initialize the NVIDIA NIM OpenAI-compatible client."""
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
        )
    return _client


import inspect

async def _call_llm_with_tracking(**kwargs):
    """Wraps client.chat.completions.create to track API latency and success rates."""
    client = _get_client()
    start_time = time.time()
    
    # Auto-detect caller function name
    try:
        endpoint_name = inspect.currentframe().f_back.f_code.co_name
    except Exception:
        endpoint_name = "unknown"
        
    
    try:
        completion = await client.chat.completions.create(**kwargs)
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Fire and forget logging
        await APILog(
            endpoint=endpoint_name,
            response_time_ms=duration_ms,
            success=True,
            status_code=200
        ).insert()
        
        return completion
        
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        status_code = 500
        
        if isinstance(e, openai.APIError):
            status_code = e.status_code if hasattr(e, 'status_code') and e.status_code else 500
            
        await APILog(
            endpoint=endpoint_name,
            response_time_ms=duration_ms,
            success=False,
            status_code=status_code,
            error_message=str(e)
        ).insert()
        
        raise e


async def analyze_resume_ats(
    resume_text: str, job_description: str
) -> Dict[str, Any]:
    """Analyze a resume against a job description for ATS compatibility."""
    client = _get_client()
    if job_description and job_description.strip():
        jd_section = f"\nJOB DESCRIPTION:\n{job_description}\n"
        instruction = """
Evaluate the provided RESUME against the provided JOB DESCRIPTION. 
Calculate an ATS match score based strictly on keyword overlaps, required experience, and skills alignment.
Do not hallucinate keywords. Only list keywords present in the JD as missing if the resume lacks them.
"""
    else:
        jd_section = ""
        instruction = """
Evaluate the provided RESUME on general industry best practices since no Job Description was provided.
Calculate a general quality score based on: actionable verbs, quantifiable achievements, clear formatting, and standard industry skills.
For "missing_keywords", provide 3-5 highly sought-after industry skills that the candidate might consider adding based on their current profile.
Do not hallucinate skills they already have.
"""

    prompt = f"""You are a strict and highly accurate Applicant Tracking System (ATS) evaluator.

{instruction}

RESUME:
{resume_text}
{jd_section}

You MUST return your analysis as a valid JSON object matching the exact schema below. Do not include markdown code blocks (like ```json), conversational text, or any other formatting.

{{
  "score": <integer from 0 to 100>,
  "matched_keywords": ["keyword1", "keyword2", ...],
  "missing_keywords": ["missing1", "missing2", ...],
  "suggestions": ["Specific, actionable suggestion 1", "Specific suggestion 2", ...]
}}
"""

    completion = await _call_llm_with_tracking(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=2000,
    )

    content = completion.choices[0].message.content or "{}"
    return _parse_llm_json(content, fallback={
            "question": "Tell me about a challenging project you've worked on.",
            "category": "Behavioral",
            "tips": "Use the STAR method: Situation, Task, Action, Result.",
        })


async def evaluate_interview_answer(
    question: str, answer: str, role: str
) -> Dict[str, Any]:
    """Evaluate an interview answer and provide feedback."""
    client = _get_client()
    prompt = f"""You are an expert interviewer for a {role} position.

Evaluate the following answer to the interview question.

QUESTION: {question}
ANSWER: {answer}

Return a JSON object with:
- "score": integer from 0 to 100
- "strengths": list of 2-3 things done well
- "weaknesses": list of 2-3 areas for improvement
- "improved_answer": a brief example of a stronger answer (2-3 sentences)

Return ONLY valid JSON."""

    completion = await _call_llm_with_tracking(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=1500,
    )

    content = completion.choices[0].message.content or "{}"
    return _parse_llm_json(content, fallback={
            "score": 50,
            "strengths": ["Attempted to answer the question"],
            "weaknesses": ["Could provide more specific examples"],
            "improved_answer": "Unable to parse AI feedback. Please try again.",
        })

async def suggest_projects(skills: str, time_commitment: str, interests: str) -> List[Dict[str, Any]]:
    """Suggest software projects based on user skills, time, and interests."""
    client = _get_client()
    prompt = f"""You are an expert software engineering mentor. Based on the following user profile, suggest 3 to 5 realistic software projects they can build for their portfolio.

User Skills: {skills}
Available Time: {time_commitment}
Interests/Goals: {interests}

For each project, provide:
- "id": a unique short string identifier
- "title": a catchy project title
- "description": a brief 1-2 sentence description
- "rating": an integer from 1 to 10 evaluating how good this project is for their portfolio
- "skill_level": e.g., "Beginner", "Intermediate", "Advanced"
- "estimated_time": e.g., "2 weeks", "40 hours"
- "key_technologies": list of 3-5 technologies

Return a JSON array of project objects. Return ONLY valid JSON, no markdown formatting."""

    completion = await _call_llm_with_tracking(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=1500,
    )

    content = completion.choices[0].message.content or "{}"
    return _parse_llm_json(content, fallback=[])

async def generate_project_roadmap(project_details: Dict[str, Any], preferences: Dict[str, str] = None) -> Dict[str, Any]:
    """Generate a step-by-step roadmap for a specific project."""
    client = _get_client()
    
    prefs_text = ""
    if preferences:
        prefs_text = "\nUser Preferences for this Roadmap:\n"
        for k, v in preferences.items():
            if v and v.strip():
                prefs_text += f"- {k}: {v}\n"

    prompt = f"""You are an expert technical lead creating a development roadmap.

Create a step-by-step implementation roadmap for the following project:
Title: {project_details.get('title')}
Description: {project_details.get('description')}
Technologies: {', '.join(project_details.get('key_technologies', []))}
{prefs_text}
Return a JSON object with a "phases" array. Each phase should have:
- "phase_number": integer
- "title": string
- "description": string
- "tasks": a list of string tasks to complete in this phase

Ensure the roadmap strictly adheres to the user's preferences if provided.
Return ONLY valid JSON, no markdown formatting."""

    completion = await _call_llm_with_tracking(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=2000,
    )

    content = completion.choices[0].message.content or "{}"
    return _parse_llm_json(content, fallback={"phases": []})

async def tailor_resume_latex(latex_code: str, recommendations: List[str], custom_instructions: str) -> str:
    """Modify LaTeX resume code based on ATS recommendations and user instructions."""
    client = _get_client()
    
    recs_text = "\n".join([f"- {r}" for r in recommendations]) if recommendations else "None"
    custom_text = custom_instructions if custom_instructions else "None"

    prompt = f"""You are an expert LaTeX developer and career coach.
I will provide you with the raw LaTeX source code of a user's resume.
Your task is to modify the LaTeX code to incorporate the following ATS recommendations and custom user instructions.

ATS Recommendations to apply:
{recs_text}

Custom User Instructions:
{custom_text}

Original LaTeX Code:
```latex
{latex_code}
```

Instructions:
1. Make targeted, intelligent edits to the LaTeX code to fulfill the requests.
2. Ensure the resulting LaTeX code remains valid, compilable, and syntactically correct.
3. Do NOT change the overall layout, styling, or document class unless explicitly requested.
4. CRITICAL: You MUST escape all LaTeX special characters like &, %, $, _, # by preceding them with a backslash (e.g. \\&, \\%, \\$, \\_, \\#) inside text content.
5. CRITICAL: Do NOT delete or modify the user's contact information (email, phone, LinkedIn, GitHub, etc.) or any existing hyperlinks (\\href) unless explicitly requested. Keep them exactly where they are.
6. Output ONLY the raw updated LaTeX code. Do NOT wrap it in markdown blocks (e.g. ```latex). Do NOT add any conversational text.
"""

    completion = await _call_llm_with_tracking(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=4000,
    )

    content = completion.choices[0].message.content or latex_code
    content = content.strip()
    
    if "```latex" in content:
        content = content.split("```latex")[1]
    elif "```" in content:
        content = content.split("```")[1]
        
    if "```" in content:
        content = content.split("```")[0]
        
    return content.strip()
        
    if "```" in content:
        content = content.split("```")[0]
        
    return content.strip()

async def generate_cover_letter(resume_text: str, job_description: str) -> str:
    """Generate a cover letter based on a resume and job description."""
    client = _get_client()
    
    prompt = f"""You are an expert career coach and professional copywriter.
Write a highly professional, engaging, and concise cover letter for the following job description based on the candidate's resume.

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME:
{resume_text}

Instructions:
1. Do not use generic, overly robotic openings (like "I am writing to express my interest in..."). Be enthusiastic and direct.
2. Highlight 2-3 specific skills or experiences from the resume that directly match the job description.
3. Keep it under 350 words.
4. Output ONLY the raw cover letter text. Do not include markdown blocks or conversational text. Use placeholders like [Your Name] or [Company Name] if information is missing.
"""

    completion = await _call_llm_with_tracking(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        max_tokens=1000,
    )

    content = completion.choices[0].message.content or "{}"
    return _parse_llm_json(content, fallback={
            "headline_suggestions": ["Unable to parse suggestions."],
            "summary_rewrite": "Unable to parse summary rewrite. Please try again.",
            "experience_improvements": []
        })

async def smart_fill_resume_fields(resume_text: str, required_fields: List[str], user_profile: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """Smart fill resume fields based on extracted text, stored profile data, and required template fields."""
    client = _get_client()
    fields_list = "\n".join([f'- "{field}"' for field in required_fields])
    
    profile_section = f"\nUSER STORED PROFILE DATA:\n{json.dumps(user_profile, indent=2, default=str)}\n" if user_profile else ""
    
    prompt = f"""You are an expert resume assistant. Extract comprehensive information from the provided resume text and stored profile data to intelligently pre-fill out the specified required fields for a new resume template.

RESUME TEXT:
{resume_text}
{profile_section}
REQUIRED FIELDS:
{fields_list}

Instructions:
1. Extract ALL relevant details for each required field. Do not summarize or truncate if the field represents a list of items (e.g., Experience, Projects, Education) - include all the entries you can find.
2. If a field represents bullet points or multiple items, separate them clearly using newlines or bullet formats (e.g., - ) so they render nicely.
3. If a field's information is completely missing, leave the value as an empty string "".
4. Return your answer as a valid JSON object mapping each required field to the extracted text value.
5. Do not include markdown code blocks (like ```json), conversational text, or any other formatting. Output ONLY the JSON object.
"""

    completion = await _call_llm_with_tracking(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2000,
    )

    content = completion.choices[0].message.content or "{}"
    return _parse_llm_json(content, fallback={})
