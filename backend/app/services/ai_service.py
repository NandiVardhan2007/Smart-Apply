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
5. Output ONLY the raw updated LaTeX code. Do NOT wrap it in markdown blocks (e.g. ```latex). Do NOT add any conversational text.
"""

    completion = await client.chat.completions.create(
        model=settings.NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=4000,
    )

    content = completion.choices[0].message.content or latex_code
    content = content.strip()
    
    if content.startswith("```latex"):
        content = content[8:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
        
    return content.strip()


async def generate_portfolio_html(user_data: Dict[str, Any], theme: str, custom_instructions: str = "") -> str:
    """Generate a full HTML/CSS portfolio website based on user data and theme."""
    client = _get_client()
    
    prompt = f"""You are an elite frontend developer and UI/UX designer. Your task is to generate a breathtaking, fully responsive, single-page portfolio website that will WOW employers. 

## USER PROFILE DATA
- Name: {user_data.get('full_name', 'Anonymous User')}
- Bio: {user_data.get('bio', 'A passionate professional looking to build amazing things.')}
- Education: {user_data.get('education', 'Self-taught')}
- LinkedIn: {user_data.get('linkedin', '#')}
- GitHub: {user_data.get('github', '#')}

## FULL RESUME DATA
(Extract the user's actual skills, experience, and projects from the raw text below and incorporate them into the website. Do not hallucinate projects if real ones are provided here!)
---
{user_data.get('extracted_text', '')}
---

## REQUESTED THEME: {theme}
(Apply the following visual rules based strictly on this theme):
- **Neo-Brutalism**: Hard black borders (3px-4px), solid bold colors (yellow #F1C40F, pink #FF6B6B, blue #2F8FFF), heavy sharp drop shadows (e.g. `box-shadow: 8px 8px 0px #000`), bold uppercase typography (import 'Space Grotesk' from Google Fonts), asymmetric layouts.
- **Minimalist**: Maximum whitespace, very subtle grays (#FAFAFA, #111), clean typography (import 'Inter' from Google Fonts), no borders, delicate hover opacities, highly elegant and spacious layout, sophisticated grid.
- **Cyberpunk**: Dark background (#0d0d0d), neon accents (cyan #00ffcc, magenta #ff00ff), monospace fonts (import 'Fira Code'), glowing drop shadows (`box-shadow: 0 0 10px #00ffcc`), scanline overlays, high-tech angular UI.
- **Clean Professional**: Standard modern enterprise styling, soft diffuse shadows (`box-shadow: 0 4px 20px rgba(0,0,0,0.05)`), rounded corners (8px), primary blue tones (#2563EB), highly readable (import 'Roboto').
- **Retro 90s Web**: Web-safe colors, tiled background patterns or gray backgrounds, classic fonts (Times New Roman or Comic Sans), HTML table-like borders, blue underlined links, marquee tags for bio, vintage nostalgia.
- **Dark Mode Hacker**: Pitch black background (#000000), terminal green text (#00ff00), monospace font (Courier New), blinking cursor effects, command-line aesthetic, very stark contrast.
- **Glassmorphism**: Beautiful colorful mesh gradient background, translucent frosted-glass panels (`background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);`), white borders (`border: 1px solid rgba(255,255,255,0.2)`), soft elegant text.
- **Y2K Aesthetic**: Metallic gradients, chunky rounded borders, bright pinks and purples (#FF00FF, #00FFFF), early 2000s tech vibe, bubbly fonts (import 'Varela Round'), fun hover effects.

## CUSTOM INSTRUCTIONS
{custom_instructions}

## STRICT REQUIREMENTS FOR A PREMIUM WEBSITE
1. **Architecture**: Output exactly ONE file containing HTML, embedded CSS (`<style>`), and embedded JS (`<script>`).
2. **Sections**: Include the following fully fleshed-out sections:
   - **Navbar**: Sticky header with smooth scroll links to sections.
   - **Hero**: Massive striking typography for the Name, a descriptive subtitle, and primary/secondary CTA buttons (e.g. "View Projects", "Contact Me"). Include an abstract CSS shape or pattern background.
   - **About**: Use the provided Bio. Make it visually engaging, not just a wall of text.
   - **Skills**: Create a visually appealing grid or tag cloud of relevant skills (infer technical skills if none are provided).
   - **Projects**: Create at least 3 high-quality placeholder project cards with mock titles, descriptions, and tag chips. Make the cards highly interactive on hover.
   - **Education/Experience**: Display the provided education in a beautiful timeline format.
   - **Footer**: Clean footer with the GitHub and LinkedIn links styled as modern icon buttons (Use FontAwesome CDN `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">`).
3. **Animations**: You MUST include CSS micro-animations. Use `@keyframes` for floating elements, pulse effects, or entrance animations. Add a tiny script at the bottom using `IntersectionObserver` to add a `visible` class to sections as they scroll into view (fade-up effect).
4. **Layout**: Use CSS Grid and Flexbox extensively. Ensure it is 100% responsive (use media queries to stack elements nicely on mobile).
5. **Output**: Output ONLY the raw HTML string. Do NOT use markdown code blocks (no ```html ... ```). Start exactly with `<!DOCTYPE html>` and end with `</html>`. Do not write any conversational text.
"""

    completion = await client.chat.completions.create(
        model="nvidia/llama-3.1-nemotron-ultra-253b-v1",
        messages=[
            {"role": "system", "content": "You are a master frontend developer. You only output raw HTML."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.6,
        max_tokens=4000,
    )

    content = completion.choices[0].message.content or "<html><body><h1>Error generating portfolio.</h1></body></html>"
    content = content.strip()
    
    # Strip markdown block formatting if the LLM adds it anyway
    if content.startswith("```html"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
        
    return content.strip()

