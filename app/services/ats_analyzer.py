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


ANALYSIS_SYSTEM_PROMPT = """You are a world-class ATS (Applicant Tracking System) Specialist and Executive Resume Reviewer. 
Your goal is to perform a BRUTALLY HONEST, STRICT, and COMPREHENSIVE analysis of the provided resume. 

Evaluate across exactly 8 categories and return ONLY raw JSON matching the schema below.

### EVALUATION CRITERIA:
1. **Keyword Relevance**: Identify specific industry-standard keywords. Compare JD keywords (if provided) with resume keywords. Check for frequency, variety, and appropriate placement.
2. **Formatting & Structure**: DETECT: 
    - Columns or tables (which often break enterprise parsers)
    - Non-standard fonts or icons
    - Charts, images, or graphics
    - Complex headers/footers
    - Section header clarity (e.g., is "Work History" recognized?)
3. **Section Completeness**: Verify existence of:
    - Professional Summary/Objective
    - Detailed Work Experience (with dates)
    - Education (degree, institution)
    - Clean Skills list
    - Contact Information (email, phone, LinkedIn/GitHub)
4. **Quantified Achievements**: Look for specific metrics (%, $, #, time, scale). Deduct points for generic "responsible for" bullets without evidence of impact. Every bullet should ideally follow the "Result + Action + Context" formula.
5. **Strong Action Verbs**: Identify repetitive, weak, or passive verbs (e.g., "managed", "helped", "worked on"). Recommend high-impact alternatives (e.g., "orchestrated", "transformed", "navigated").
6. **Readability & Clarity**: Assess the "one-minute scan" quality. Check for density of text, excessive jargon, passive voice, and document length (1-2 pages ideally). 
7. **Common ATS Traps**: Specifically identify:
    - Tables/Columns in headers
    - Text inside images
    - Unusual divider symbols or bullet points
    - Hidden white text (if detectable)
    - Incorrect date formats (e.g., Jan 22 vs 01/2022)
8. **Job Description Match**: Evaluate how well the candidate's trajectory aligns with the target role and JD. If no JD is provided, evaluate for general professional marketability in their target field.

### JSON SCHEMA:
{
  "overall_score": <0-100>,
  "overall_grade": "<A+ to F>",
  "summary": "<Punchy 2-sentence summary of overall findings>",
  "categories": [
    {
      "name": "<Category Name>",
      "score": <0-100>,
      "grade": "<A-F>",
      "icon": "<search|format_list_bulleted|checklist|trending_up|edit_note|visibility|warning|target>",
      "findings": ["Direct specific issue or finding 1", "Direct specific issue or finding 2"],
      "suggestions": ["Actionable correction 1", "Actionable correction 2"]
    }
  ],
  "milestones": ["Key Strength 1", "Key Strength 2", "Key Strength 3"],
  "drawbacks": ["Specific Weakness 1", "Specific Weakness 2", "Specific Weakness 3"],
  "improvement_plan": [
    {
      "priority": "<HIGH|MEDIUM|LOW>", 
      "action": "<Direct, imperative action step>",
      "impact": "<Predicted score/ranking lift>",
      "details": "<Step-by-step instruction on HOW to fix it>"
    }
  ]
}

### RULES:
- NO preamble or conversational filler.
- NO markdown. ONLY raw JSON.
- Findings must be SPECIFIC to the resume content (don't say "improve verbs", say "replace 'led' in the first bullet with 'orchestrated'").
- Suggestions must be IMMEDIATELY ACTIONABLE.
- Score strictly: An "average" resume should score 60-70. Only truly elite, ATS-optimized resumes should score 90+.
- Exactly 8 categories. Exactly 3 milestones. Exactly 3 drawbacks. Exactly 4 improvement steps.
"""

JD_CONTEXT_TEMPLATE = """
--- JOB DESCRIPTION (Target alignment evaluation) ---
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
    
    user_content = f"Analyze this resume content for strict ATS compatibility and professional impact:\n\n{resume_text}"
    
    if job_description and job_description.strip():
        user_content += "\n\n" + JD_CONTEXT_TEMPLATE.format(job_description=job_description)
    else:
        user_content += "\n\n(No job description provided — analyze for general market alignment based on inferred target role.)"

    raw_content = ""
    try:
        # Use await because get_next_client now returns AsyncOpenAI
        response = await client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            temperature=0.1, 
            max_tokens=4096 
        )
        
        raw_content = response.choices[0].message.content.strip()
        result = robust_json_loads(raw_content)

        if not result:
            logger.error(f"[ATS Analyzer] Failed to parse AI response: {raw_content[:500]}")
            return _fallback_result("Invalid AI response format")
        
        return _validate_and_normalize(result)
        
    except Exception as e:
        logger.error(f"[ATS Analyzer] Final failure: {e}")
        try: logger.error(f"[ATS Analyzer] Raw content was: {raw_content[:500]}...")
        except: pass
        return _fallback_result(f"Analysis error: {str(e)}")


def _validate_and_normalize(result: dict) -> dict:
    """Ensures all required fields exist with proper types and matching icons."""
    result.setdefault("overall_score", 50)
    result["overall_score"] = max(0, min(100, int(result["overall_score"])))
    result.setdefault("overall_grade", _score_to_grade(result["overall_score"]))
    result.setdefault("summary", "Analysis complete.")
    
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
    
    # Normalize mapping (sometimes AI slightly changes names)
    normalized_cats = []
    seen_names = set()
    
    # Search for our 8 intended categories in what the AI returned
    target_names = list(icon_map.keys())
    
    for target in target_names:
        # Try to find a match in the returned categories
        match = next((c for c in categories if target.lower() in c.get("name", "").lower()), None)
        
        if match:
            match["name"] = target # Standardize name
            match["icon"] = icon_map[target]
            match.setdefault("score", 50)
            match["score"] = max(0, min(100, int(match["score"])))
            match.setdefault("grade", _score_to_grade(match["score"]))
            normalized_cats.append(match)
        else:
            # Create a shell if AI missed it
            normalized_cats.append({
                "name": target,
                "score": 0,
                "grade": "F",
                "icon": icon_map[target],
                "findings": ["Category was not specifically evaluated by AI."],
                "suggestions": ["Ensure your resume includes data for this category."]
            })

    result["categories"] = normalized_cats[:8]
    
    result.setdefault("milestones", [])
    result.setdefault("drawbacks", [])
    
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
