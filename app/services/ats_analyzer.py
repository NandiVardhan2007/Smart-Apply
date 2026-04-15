"""
ATS Resume Analyzer Service
Deep, multi-dimensional resume analysis powered by NVIDIA NIM.
Evaluates across 8 categories and returns structured improvement data.
"""

import json
import logging
from app.services.ai_parser import get_next_client
from app.utils.json_repair import robust_json_loads

logger = logging.getLogger(__name__)


def is_resume(text: str) -> bool:
    """
    Strictly validates if the provided text is a resume.
    Checks for presence of standard resume sections and metadata.
    """
    if not text or len(text.strip()) < 100:
        return False

    text_lower = text.lower()
    
    # Standard resume sections
    sections = [
        "experience", "work history", "employment", 
        "education", "academic",
        "skills", "technologies", "expertise",
        "projects", "achievements",
        "contact", "summary", "objective"
    ]
    
    # Requirement: Must find at least 3 standard section headers
    found_sections = [s for s in sections if s in text_lower]
    
    # Requirement: Often resumes have contact markers
    contact_markers = ["@", "phone", "mobile", "linkedin.com", "github.com", "address"]
    found_markers = [m for m in contact_markers if m in text_lower]
    
    # Reject logic for common non-resume documents
    blacklisted_keywords = [
        "question bank", "assignment", "homework", "lecture notes", 
        "syllabus", "examination", "marksheet", "transcript",
        "letter of recommendation", "cover letter"
    ]
    is_blacklisted = any(k in text_lower for k in blacklisted_keywords)
    
    # A valid resume should have at least 3 sections AND at least 1 contact marker
    # and NOT be in the blacklist.
    is_valid = len(found_sections) >= 3 and len(found_markers) >= 1 and not is_blacklisted
    
    logger.info(f"[ATS Validation] Result: {is_valid} (Sections: {len(found_sections)}, Markers: {len(found_markers)}, Blacklisted: {is_blacklisted})")
    return is_valid


ANALYSIS_SYSTEM_PROMPT = """You are an elite ATS analyst. Evaluate the resume across exactly 8 categories and return ONLY raw JSON.

**JSON SCHEMA:**
{
  "overall_score": <0-100>,
  "overall_grade": "<A+ to F>",
  "summary": "<2-sentence summary>",
  "categories": [
    {
      "name": "<Category>",
      "score": <0-100>,
      "grade": "<A-F>",
      "icon": "<search|format_list_bulleted|checklist|trending_up|edit_note|visibility|warning|target>",
      "findings": ["Short finding 1", "Short finding 2"],
      "suggestions": ["Short action 1", "Short action 2"]
    }
  ],
  "milestones": ["Strength 1", "Strength 2", "Strength 3"],
  "drawbacks": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "improvement_plan": [
    {
      "priority": "<HIGH|MEDIUM|LOW>", "action": "<Direct action>",
      "impact": "<Predicted lift>", "details": "<Instruction>"
    }
  ]
}

**CATEGORIES:** 1. Keyword Relevance, 2. Formatting, 3. Completeness, 4. Metrics, 5. Action Verbs, 6. Clarity, 7. ATS-Hostile, 8. Market Match.

**RULES:** NO preamble. NO markdown. ONLY raw JSON. Max 2 concise findings per category. Exactly 3 milestones/drawbacks. Exactly 4 improvements.
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

    raw_content = ""
    try:
        # Use await because get_next_client now returns AsyncOpenAI
        response = await client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            temperature=0.1, # Lower temperature for better formatting
            max_tokens=4096 # Increased from 2048 to handle more detailed analysis without truncation
        )
        
        raw_content = response.choices[0].message.content.strip()
        result = robust_json_loads(raw_content)

        if not result:
            logger.error(f"[ATS Analyzer] Failed to parse AI response: {raw_content[:500]}")
            return _fallback_result("Invalid AI response format")
        
        return _validate_and_normalize(result)
        
    except Exception as e:
        logger.error(f"[ATS Analyzer] Final failure: {e}")
        # Log the first 500 chars of raw_content if possible for debugging
        try: logger.error(f"[ATS Analyzer] Raw content was: {raw_content[:500]}...")
        except: pass
        return _fallback_result(f"Analysis error: {str(e)}")


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
