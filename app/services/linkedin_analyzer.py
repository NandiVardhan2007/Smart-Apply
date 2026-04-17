"""
LinkedIn Profile Analyzer Service
AI-powered LinkedIn profile optimization using NVIDIA NIM.
Evaluates across 8 categories and returns structured improvement data.
"""

import json
import logging
from app.services.ai_parser import get_next_client
from app.services.memory_service import memory_service
from app.schemas.memory import MemoryCreate

from app.utils.json_repair import robust_json_loads
from app.core.config import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


LINKEDIN_ANALYSIS_PROMPT = """You are an elite LinkedIn profile strategist and personal branding expert.

Your task is to perform a DEEP, comprehensive analysis of the provided LinkedIn profile data. You must evaluate the profile across exactly 8 categories and return a structured JSON report with actionable optimization suggestions.

**ANALYSIS CATEGORIES:**

1. **Headline Power** — Evaluate the headline for keyword richness, clarity of value proposition, role specificity, and recruiter search visibility. A headline should tell WHO you are, WHAT you do, and the VALUE you bring.

2. **About/Summary Quality** — Assess the about section for storytelling, keyword integration, call to action, length (ideally 2000+ characters), and whether it showcases unique value. Check if it addresses the reader (recruiters, hiring managers).

3. **Experience Impact** — Evaluate work experience entries for quantified achievements, action verbs, STAR method usage, progression narrative, and relevance to target roles. Flag vague bullet points.

4. **Education & Certifications** — Check completeness of education entries, relevant certifications, continuing education signals, and whether they align with career goals.

5. **Skills & Endorsements Strategy** — Assess skill selection for relevance to target roles, trending industry skills, number of skills listed, and strategic ordering. Flag missing high-demand skills.

6. **Visual Branding** — Evaluate profile photo presence, banner image, overall visual completeness. A profile with both photo and banner gets 21x more views.

7. **Profile Completeness** — Overall completeness check: headline, about, experience, education, skills, certifications, location, contact info, recommendations. LinkedIn "All-Star" status requirements.

8. **Keyword & Search Optimization** — Evaluate keyword density and placement for recruiter search visibility. Check if the right industry keywords appear in headline, about, experience, and skills sections.

**INPUT FORMAT — You will receive structured profile data including:**
- Full name, headline, about section, location, current role
- Experience entries (title, company, dates, description)
- Education entries (institution, degree, field, dates)
- Skills list, certifications list
- Profile photo and banner status
- Connection count

**OUTPUT FORMAT — Return ONLY valid JSON matching this exact structure:**

{
  "overall_score": <integer 0-100>,
  "overall_grade": "<A+|A|A-|B+|B|B-|C+|C|C-|D|F>",
  "summary": "<2-3 sentence executive summary of the profile's optimization status and biggest opportunities>",
  "categories": [
    {
      "name": "<Category Name>",
      "score": <integer 0-100>,
      "grade": "<letter grade>",
      "icon": "<one of: title, person, work, school, psychology, image, checklist, search>",
      "findings": ["<specific finding 1>", "<specific finding 2>", "..."],
      "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "..."]
    }
  ],
  "strengths": [
    "<strength/positive aspect 1>",
    "<strength/positive aspect 2>",
    "..."
  ],
  "weaknesses": [
    "<weakness/area for improvement 1>",
    "<weakness/area for improvement 2>",
    "..."
  ],
  "improvement_plan": [
    {
      "priority": "<HIGH|MEDIUM|LOW>",
      "action": "<specific action to take>",
      "impact": "<estimated impact, e.g. 'Can increase profile views by ~40%'>",
      "details": "<1-2 sentence explanation with a concrete example or template>"
    }
  ]
}

**RULES:**
- **Student/Entry Mode**: If the profile indicates the user is a student (e.g. headline says 'Student at' or experience is empty but education is present), pivot advice to focus on: Projects, Skills, Societies, Internships, and Academic Achievements. Do NOT grill students for missing "work progression narratives".
- **No Hallucinations/Generic Strengths**: Never list "Potential to improve" or "Opportunity to start from scratch" as a strength. Strengths must be things that ARE ALREADY GOOD in the current profile data (e.g. "Professional photo detected", "High connection count", "Strong set of 40+ skills"). If no strengths exist, be honest.
- **Strict Evidence-Based Improvements**: If the technical data shows `has_profile_photo: true`, DO NOT suggest "Add a photo". Instead, if the score is low, suggest "Updating to a high-resolution, business-oriented headshot".
- **Be Actionable**: Provide specific and actionable suggestions — generic advice like "improve your profile" is forbidden. Include CONCRETE examples and templates (e.g., "Change your headline to: 'Software Engineering Student | Future-Focused Developer | Active in Coding Society'").
- **Weighted Scoring**: The overall_score should realistically reflect the content. A profile with only Education and Skills should score between 30-50, not 0 nor 80.
- **Valid JSON**: Ensure all strings are properly escaped and all items in arrays/objects are separated by commas. Return ONLY the valid JSON object.

**STRICT JSON MODE FORCED:**
- Your response must begin with '{' and end with '}'.
- DO NOT provide any preamble, markdown formatting (like ```json), or post-analysis commentary.
- DO NOT use the characters '**' or '###' outside of JSON string values.
- If you fail to follow this, the system will crash. Return ONLY RAW PARSEABLE JSON.
"""


def _format_profile_for_ai(profile_data: dict) -> str:
    """Formats the extracted LinkedIn profile data into a readable string for the AI."""
    parts = []

    parts.append(f"Full Name: {profile_data.get('full_name', 'Not provided')}")
    parts.append(f"Headline: {profile_data.get('headline', 'Not set')}")
    parts.append(f"Location: {profile_data.get('location', 'Not set')}")
    parts.append(f"Current Role: {profile_data.get('current_role', 'Not specified')}")
    parts.append(f"Connections: {profile_data.get('connections_count', 'Unknown')}")
    parts.append(f"Has Profile Photo: {'Yes' if profile_data.get('has_profile_photo') else 'No'}")
    parts.append(f"Has Banner Image: {'Yes' if profile_data.get('has_banner_photo') else 'No'}")

    about = profile_data.get('about', '')
    parts.append(f"\n--- ABOUT/SUMMARY ---\n{about if about else '(Empty — no about section)'}")

    # Experience
    experience = profile_data.get('experience', [])
    parts.append(f"\n--- EXPERIENCE ({len(experience)} entries) ---")
    if experience:
        for i, exp in enumerate(experience, 1):
            parts.append(f"\n  [{i}] {exp.get('title', 'Untitled')} at {exp.get('company', 'Unknown Company')}")
            parts.append(f"      Duration: {exp.get('date_range', 'Not specified')}")
            parts.append(f"      Location: {exp.get('location', 'Not specified')}")
            desc = exp.get('description', '')
            parts.append(f"      Description: {desc if desc else '(No description provided)'}")
    else:
        parts.append("  (No experience entries found)")

    # Education
    education = profile_data.get('education', [])
    parts.append(f"\n--- EDUCATION ({len(education)} entries) ---")
    if education:
        for i, edu in enumerate(education, 1):
            parts.append(f"\n  [{i}] {edu.get('degree', '')} {edu.get('field_of_study', '')} — {edu.get('institution', 'Unknown')}")
            parts.append(f"      Duration: {edu.get('date_range', 'Not specified')}")
    else:
        parts.append("  (No education entries found)")

    # Skills
    skills = profile_data.get('skills', [])
    parts.append(f"\n--- SKILLS ({len(skills)} listed) ---")
    parts.append(", ".join(skills) if skills else "(No skills listed)")

    # Certifications
    certs = profile_data.get('certifications', [])
    parts.append(f"\n--- CERTIFICATIONS ({len(certs)} listed) ---")
    parts.append(", ".join(certs) if certs else "(No certifications listed)")

    return "\n".join(parts)


async def analyze_linkedin_profile(profile_data: dict, user_id: str = None) -> dict:
    """
    Performs a comprehensive AI analysis of the provided LinkedIn profile data.
    Uses user memory if available to personalize recommendations.
    """
    client = get_next_client()
    
    # Fetch user memory for personalization if user_id is provided
    user_context = ""
    if user_id:
        try:
            memories = await memory_service.get_memories(user_id, category="career_goals")
            if memories:
                goals = [m.get("content") for m in memories]
                user_context = f"\n\nUSER'S CAREER GOALS & PREFERENCES (Tailor advice to these):\n" + "\n".join([f"- {g}" for g in goals])
        except Exception as e:
            logger.warning(f"Failed to fetch user memory for analysis: {e}")

    formatted_profile = _format_profile_for_ai(profile_data)
    # Truncate to avoid huge context windows
    formatted_profile = formatted_profile[:8000]

    user_content = f"Analyze this LinkedIn profile and provide optimization suggestions{user_context}:\n\n{formatted_profile}"

    messages = [
        {"role": "system", "content": LINKEDIN_ANALYSIS_PROMPT},
        {"role": "user", "content": user_content}
    ]

    max_retries = 2
    last_error = ""

    for attempt in range(max_retries):
        try:
            logger.info(f"[LinkedIn Analyzer] Analysis attempt {attempt + 1}")
            response = await client.chat.completions.create(
                model="meta/llama-3.1-8b-instruct",
                messages=messages,
                temperature=0.1,
                max_tokens=4096
            )

            raw_content = response.choices[0].message.content.strip()
            result = robust_json_loads(raw_content)

            if result and result.get("overall_score") is not None:
                # Success!
                return _validate_and_normalize(result)
            
            # If we're here, parsing failed or was incomplete
            logger.warning(f"[LinkedIn Analyzer] Attempt {attempt + 1} produced unparseable JSON.")
            if attempt == 0:
                # Add a retry message to the conversation
                messages.append({"role": "assistant", "content": raw_content})
                messages.append({
                    "role": "user", 
                    "content": "ERROR: Your previous response was NOT valid JSON. It contained extra text or markdown. "
                               "Return ONLY the raw JSON object starting with '{' and ending with '}'. No formatting tags."
                })
            last_error = "Malformed AI response"

        except Exception as e:
            logger.error(f"[LinkedIn Analyzer] Attempt {attempt + 1} failed: {e}")
            last_error = str(e)

    except Exception as e:
        logger.warning(f"[LinkedIn Analyzer] Primary Engine (NVIDIA) failed: {e}. Attempting Gemini Fallback.")
        
        # --- FALLBACK: GOOGLE GEMINI ---
        if settings.GOOGLE_API_KEY:
            try:
                gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
                
                # Adapt prompt for Gemini
                gemini_system = LINKEDIN_ANALYSIS_PROMPT + "\n\nCRITICAL: Return ONLY raw JSON. No preamble or markdown tags."
                
                response = gemini_client.models.generate_content(
                    model="gemini-flash-latest",
                    contents=[types.Content(role="user", parts=[types.Part.from_text(text=user_content)])],
                    config=types.GenerateContentConfig(
                        system_instruction=gemini_system,
                        temperature=0.1,
                        candidate_count=1
                    )
                )
                
                raw_content = response.text.strip()
                # Clean up markdown if Gemini adds it
                if "```json" in raw_content:
                    raw_content = raw_content.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_content:
                    raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
                result = robust_json_loads(raw_content)
                if result:
                    logger.info("[LinkedIn Analyzer] Gemini Fallback SUCCEEDED.")
                    return _validate_and_normalize(result)
                else:
                    logger.error(f"[LinkedIn Analyzer] Gemini Fallback failed to produce valid JSON: {raw_content[:500]}")
            except Exception as gemini_err:
                logger.error(f"[LinkedIn Analyzer] Gemini Fallback CRITICAL FAILURE: {gemini_err}")

        logger.error(f"[LinkedIn Analyzer] All engines exhausted. Last NVIDIA error: {last_error}")
        return _fallback_result("Our AI engines are currently congested. Please try again in a few minutes.")


def _validate_and_normalize(result: dict) -> dict:
    """Ensures all required fields exist with proper types."""
    result.setdefault("overall_score", 50)
    result["overall_score"] = max(0, min(100, int(result["overall_score"])))

    result.setdefault("overall_grade", _score_to_grade(result["overall_score"]))
    result.setdefault("summary", "Analysis complete.")

    # Category validation
    categories = result.get("categories", [])
    icon_map = {
        "Headline Power": "title",
        "About/Summary Quality": "person",
        "Experience Impact": "work",
        "Education & Certifications": "school",
        "Skills & Endorsements Strategy": "psychology",
        "Visual Branding": "image",
        "Profile Completeness": "checklist",
        "Keyword & Search Optimization": "search",
    }

    for cat in categories:
        cat.setdefault("score", 50)
        cat["score"] = max(0, min(100, int(cat["score"])))
        cat.setdefault("grade", _score_to_grade(cat["score"]))
        cat.setdefault("findings", ["No specific findings"])
        cat.setdefault("suggestions", ["No specific suggestions"])
        if "icon" not in cat or not cat["icon"]:
            cat["icon"] = icon_map.get(cat.get("name", ""), "info")

    result["categories"] = categories
    result.setdefault("strengths", [])
    result.setdefault("weaknesses", [])

    improvement_plan = result.get("improvement_plan", [])
    for item in improvement_plan:
        item.setdefault("priority", "MEDIUM")
        item.setdefault("action", "Review your profile")
        item.setdefault("impact", "May improve your visibility")
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
        "strengths": [],
        "weaknesses": ["Unable to analyze — please try again."],
        "improvement_plan": [
            {
                "priority": "HIGH",
                "action": "Reconnect your LinkedIn profile and try again",
                "impact": "Required to get analysis",
                "details": "The AI analysis encountered an error. Please reconnect your LinkedIn profile."
            }
        ]
    }
