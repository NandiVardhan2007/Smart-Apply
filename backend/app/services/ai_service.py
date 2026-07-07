import json
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI

from app.config import settings

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    """Lazy-initialize the NVIDIA NIM OpenAI-compatible client."""
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
        )
    return _client


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

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=2000,
    )

    content = completion.choices[0].message.content or "{}"
    
    try:
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_str = content[start_idx:end_idx+1]
            return json.loads(json_str)
        else:
            raise json.JSONDecodeError("No JSON object found", content, 0)
    except Exception:
        return {
            "score": 0,
            "matched_keywords": [],
            "missing_keywords": [],
            "suggestions": ["Unable to parse AI response. Please try again."],
            "raw_response": content,
        }

async def parse_resume_for_profile(resume_text: str) -> Dict[str, Any]:
    """Parse a resume to extract structured data for the user's profile."""
    client = _get_client()
    prompt = f"""You are an expert resume parser. Extract the following information from the resume text below:
- "full_name": The candidate's full name
- "bio": A short professional summary or objective
- "skills": A list of technical and soft skills
- "education": A list of strings describing educational degrees/institutions
- "experience": A list of strings describing work history
- "linkedin_url": LinkedIn profile URL if present, else null
- "github_url": GitHub profile URL if present, else null
- "portfolio_url": Portfolio or personal website URL if present, else null

RESUME:
{resume_text}

Return ONLY valid JSON, matching the keys above. No markdown or extra text."""

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=2000,
    )

    content = completion.choices[0].message.content or "{}"
    
    try:
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_str = content[start_idx:end_idx+1]
            return json.loads(json_str)
        else:
            raise json.JSONDecodeError("No JSON object found", content, 0)
    except Exception:
        return {
            "full_name": None, "bio": None, "skills": [],
            "education": [], "experience": [],
            "linkedin_url": None, "github_url": None, "portfolio_url": None
        }


async def chat_completion(messages: List[Dict[str, str]]) -> str:
    """General AI chatbot for career advice."""
    client = AsyncOpenAI(
        base_url=settings.NVIDIA_BASE_URL,
        api_key=settings.CHATBOT_API_KEY or settings.NVIDIA_API_KEY,
    )
    system_msg = {
        "role": "system",
        "content": (
            "You are Smart Apply AI, a friendly and helpful career advisor for "
            "students and job seekers. Help with resume tips, cover letters, "
            "interview preparation, job search strategies, and career guidance. "
            "Keep responses concise, actionable, and encouraging."
        ),
    }

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[system_msg] + messages,
        temperature=0.7,
        max_tokens=1500,
    )

    return completion.choices[0].message.content or "I'm sorry, I couldn't generate a response."


async def generate_interview_question(
    role: str, difficulty: str
) -> Dict[str, str]:
    """Generate an AI interview question for a given role and difficulty."""
    client = _get_client()
    prompt = f"""Generate a single {difficulty} difficulty interview question for a {role} position.

Return a JSON object with:
- "question": the interview question
- "category": the category (e.g., "Technical", "Behavioral", "System Design", "Problem Solving")
- "tips": a brief tip for how to approach this question (1-2 sentences)

Return ONLY valid JSON."""

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
        max_tokens=500,
    )

    content = completion.choices[0].message.content or "{}"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "question": "Tell me about a challenging project you've worked on.",
            "category": "Behavioral",
            "tips": "Use the STAR method: Situation, Task, Action, Result.",
        }


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

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=1500,
    )

    content = completion.choices[0].message.content or "{}"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "score": 50,
            "strengths": ["Attempted to answer the question"],
            "weaknesses": ["Could provide more specific examples"],
            "improved_answer": "Unable to parse AI feedback. Please try again.",
        }

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

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=1500,
    )

    content = completion.choices[0].message.content or "[]"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return []

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

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=2000,
    )

    content = completion.choices[0].message.content or "{}"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"phases": []}

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

    completion = await client.chat.completions.create(
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

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        max_tokens=1000,
    )

    content = completion.choices[0].message.content or "Error generating cover letter."
    return content.strip()

async def score_jobs_batch(resume_text: str, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Score a batch of jobs against a resume quickly."""
    if not jobs:
        return []

    client = _get_client()
    
    # We will pass the job titles and brief descriptions to the LLM
    jobs_summary = ""
    for i, job in enumerate(jobs):
        desc_snippet = job['description'][:400].replace('\n', ' ') if job.get('description') else ""
        jobs_summary += f"Job ID {i}:\nTitle: {job['title']}\nSnippet: {desc_snippet}\n\n"

    prompt = f"""You are an ATS matching engine. Score the following jobs based on their match with the candidate's resume.
Score each job from 0 to 100 based on title alignment and skill overlap.

CANDIDATE RESUME:
{resume_text}

JOBS:
{jobs_summary}

Return ONLY a valid JSON array of objects, where each object has:
- "index": integer (the Job ID number from above)
- "score": integer (0-100)
- "match_reason": a brief 1-sentence reason why it matches or lacks match

Do not include markdown blocks or conversational text.
"""

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1500,
    )

    content = completion.choices[0].message.content or "[]"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        results = json.loads(content)
        # map back scores
        for job in jobs:
            job["match_score"] = 50 # default
            job["match_reason"] = ""
            
        for res in results:
            idx = res.get("index")
            if idx is not None and 0 <= idx < len(jobs):
                jobs[idx]["match_score"] = res.get("score", 50)
                jobs[idx]["match_reason"] = res.get("match_reason", "")
                
    except Exception as e:
        # Fallback if JSON fails
        for job in jobs:
            job["match_score"] = 50
            job["match_reason"] = ""

    # Sort jobs by match_score descending
    jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    return jobs
