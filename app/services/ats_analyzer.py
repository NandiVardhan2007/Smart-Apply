"""
ATS Resume Analyzer Service
Deep, multi-dimensional resume analysis powered by NVIDIA NIM.
Evaluates across 8 categories and returns structured improvement data.
"""

import json
from app.services.ai_parser import get_next_client


ANALYSIS_SYSTEM_PROMPT = """You are an elite ATS (Applicant Tracking System) resume analyst and career strategist.

Your task is to perform a DEEP, comprehensive analysis of the provided resume text. You must evaluate the resume across exactly 8 categories and return a structured JSON report.

**ANALYSIS CATEGORIES:**

1. **Keyword Relevance** — Evaluate industry-specific keywords, technical skills, tools, certifications, and buzzwords. Check density and placement.

2. **Formatting & Structure** — Assess if the resume follows a clean, consistent structure. Check for proper sections, logical flow, consistent bullet points, and date formatting.

3. **Section Completeness** — Verify the presence and quality of: Contact Info, Professional Summary/Objective, Work Experience, Education, Skills, Certifications/Awards.

4. **Quantified Achievements** — Look for metrics, numbers, percentages, dollar amounts, and measurable outcomes in experience bullets. Flag vague statements.

5. **Action Verbs** — Evaluate use of strong action verbs (Led, Developed, Architected, etc.) vs weak/passive language (Responsible for, Helped with, etc.).

6. **Readability & Clarity** — Assess sentence length, clarity, jargon balance, and overall readability. Check for spelling/grammar issues and overly complex sentences.

7. **ATS-Hostile Elements** — Identify any elements that ATS systems commonly fail to parse: tables, images, graphics, multi-column layouts, headers/footers, special characters, unusual fonts, non-standard section headers.

8. **Job Description Match** — If a job description is provided, evaluate how well the resume is tailored to it. If no JD is provided, evaluate general market alignment for the apparent target role.

**OUTPUT FORMAT — Return ONLY valid JSON matching this exact structure:**

{
  "overall_score": <integer 0-100>,
  "overall_grade": "<A+|A|A-|B+|B|B-|C+|C|C-|D|F>",
  "summary": "<2-3 sentence executive summary of the resume's ATS readiness>",
  "categories": [
    {
      "name": "<Category Name>",
      "score": <integer 0-100>,
      "grade": "<letter grade>",
      "icon": "<one of: search, format_list_bulleted, checklist, trending_up, edit_note, visibility, warning, target>",
      "findings": ["<specific finding 1>", "<specific finding 2>", "..."],
      "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "..."]
    }
  ],
  "milestones": [
    "<strength/positive aspect 1>",
    "<strength/positive aspect 2>",
    "..."
  ],
  "drawbacks": [
    "<weakness/negative aspect 1>",
    "<weakness/negative aspect 2>",
    "..."
  ],
  "improvement_plan": [
    {
      "priority": "<HIGH|MEDIUM|LOW>",
      "action": "<specific action to take>",
      "impact": "<estimated score improvement, e.g. 'Can improve score by ~8 points'>",
      "details": "<1-2 sentence explanation of how to implement this>"
    }
  ]
}

**RULES:**
- Be brutally honest but constructive
- Provide at least 2 findings and 2 suggestions per category
- Provide at least 3 milestones and 3 drawbacks
- Provide at least 4 improvement items (mix of HIGH/MEDIUM/LOW priority)
- Scores should be realistic — most resumes score 50-80
- The overall_score should be a weighted average reflecting all categories
- Return ONLY the JSON object, no other text, no markdown code blocks
"""

JD_CONTEXT_TEMPLATE = """
--- JOB DESCRIPTION (use this for the "Job Description Match" category) ---
{job_description}
--- END JOB DESCRIPTION ---
"""


async def analyze_resume_ats(resume_text: str, job_description: str = None) -> dict:
    """
    Performs a comprehensive ATS analysis of the provided resume text.
    Optionally matches against a job description for tailored feedback.
    
    Returns a structured dict with scores, categories, milestones, drawbacks,
    and a prioritized improvement plan.
    """
    client = get_next_client()
    
    # Truncate text to avoid huge context windows and speed up processing
    resume_text = resume_text[:8000]
    
    user_content = f"Analyze this resume for ATS compatibility:\n\n{resume_text}"
    
    if job_description and job_description.strip():
        user_content += "\n\n" + JD_CONTEXT_TEMPLATE.format(job_description=job_description)
    else:
        user_content += "\n\n(No job description provided — evaluate for general market alignment based on the candidate's apparent target role.)"

    try:
        # Use await because get_next_client now returns AsyncOpenAI
        response = await client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3,
            max_tokens=4096
        )
        
        raw_content = response.choices[0].message.content
        
        # Clean up markdown code blocks if present
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_content:
            raw_content = raw_content.split("```")[1].split("```")[0].strip()
        
        # Parse and validate the response
        result = json.loads(raw_content)
        return _validate_and_normalize(result)
        
    except json.JSONDecodeError as e:
        print(f"[ATS Analyzer] JSON parse error: {e}")
        print(f"[ATS Analyzer] Raw content: {raw_content[:500]}")
        return _fallback_result("AI returned invalid JSON. Please try again.")
    except Exception as e:
        print(f"[ATS Analyzer] Error: {e}")
        return _fallback_result(str(e))


def _validate_and_normalize(result: dict) -> dict:
    """Ensures all required fields exist with proper types."""
    # Ensure overall score
    result.setdefault("overall_score", 50)
    result["overall_score"] = max(0, min(100, int(result["overall_score"])))
    
    # Ensure grade
    result.setdefault("overall_grade", _score_to_grade(result["overall_score"]))
    
    # Ensure summary
    result.setdefault("summary", "Analysis complete.")
    
    # Ensure categories have proper structure
    categories = result.get("categories", [])
    icon_map = {
        "Keyword Relevance": "search",
        "Formatting & Structure": "format_list_bulleted",
        "Section Completeness": "checklist",
        "Quantified Achievements": "trending_up",
        "Action Verbs": "edit_note",
        "Readability & Clarity": "visibility",
        "ATS-Hostile Elements": "warning",
        "Job Description Match": "target",
    }
    
    for cat in categories:
        cat.setdefault("score", 50)
        cat["score"] = max(0, min(100, int(cat["score"])))
        cat.setdefault("grade", _score_to_grade(cat["score"]))
        cat.setdefault("findings", ["No specific findings"])
        cat.setdefault("suggestions", ["No specific suggestions"])
        # Map icon if missing
        if "icon" not in cat or not cat["icon"]:
            cat["icon"] = icon_map.get(cat.get("name", ""), "info")
    
    result["categories"] = categories
    
    # Ensure milestones and drawbacks
    result.setdefault("milestones", [])
    result.setdefault("drawbacks", [])
    
    # Ensure improvement plan
    improvement_plan = result.get("improvement_plan", [])
    for item in improvement_plan:
        item.setdefault("priority", "MEDIUM")
        item.setdefault("action", "Review your resume")
        item.setdefault("impact", "May improve your score")
        item.setdefault("details", "")
    result["improvement_plan"] = improvement_plan
    
    return result


def _score_to_grade(score: int) -> str:
    """Convert a numeric score to a letter grade."""
    if score >= 97: return "A+"
    if score >= 93: return "A"
    if score >= 90: return "A-"
    if score >= 87: return "B+"
    if score >= 83: return "B"
    if score >= 80: return "B-"
    if score >= 77: return "C+"
    if score >= 73: return "C"
    if score >= 70: return "C-"
    if score >= 60: return "D"
    return "F"


def _fallback_result(error_msg: str) -> dict:
    """Returns a safe fallback response when analysis fails."""
    return {
        "overall_score": 0,
        "overall_grade": "N/A",
        "summary": f"Analysis could not be completed: {error_msg}",
        "categories": [],
        "milestones": [],
        "drawbacks": ["Unable to analyze — please try uploading again."],
        "improvement_plan": [
            {
                "priority": "HIGH",
                "action": "Re-upload your resume and try again",
                "impact": "Required to get analysis",
                "details": "The AI analysis encountered an error. Please re-upload your resume PDF."
            }
        ]
    }
