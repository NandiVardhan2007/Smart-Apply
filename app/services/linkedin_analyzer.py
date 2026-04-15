"""
LinkedIn Profile Analyzer Service
AI-powered LinkedIn profile optimization using NVIDIA NIM.
Evaluates across 8 categories and returns structured improvement data.
"""

import json
import logging
from app.services.ai_parser import get_next_client

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
- Be specific and actionable — generic advice like "improve your profile" is not helpful
- Provide at least 2 findings and 2 suggestions per category
- Provide at least 3 strengths and 3 weaknesses
- Provide at least 5 improvement items (mix of HIGH/MEDIUM/LOW priority)
- Include CONCRETE examples and templates in suggestions (e.g., "Change your headline to: 'Senior Flutter Developer | Building AI-Powered Mobile Apps | Ex-Google'")
- Scores should be realistic — most profiles score 40-75
- The overall_score should be a weighted average reflecting all categories
- Return ONLY the JSON object, no other text, no markdown code blocks
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


async def analyze_linkedin_profile(profile_data: dict) -> dict:
    """
    Performs a comprehensive AI analysis of the provided LinkedIn profile data.
    Returns a structured dict with scores, categories, strengths, weaknesses,
    and a prioritized improvement plan.
    """
    client = get_next_client()

    formatted_profile = _format_profile_for_ai(profile_data)
    # Truncate to avoid huge context windows
    formatted_profile = formatted_profile[:8000]

    user_content = f"Analyze this LinkedIn profile and provide optimization suggestions:\n\n{formatted_profile}"

    try:
        response = await client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": LINKEDIN_ANALYSIS_PROMPT},
                {"role": "user", "content": user_content}
            ],
            temperature=0.1,
            max_tokens=4096
        )

        raw_content = response.choices[0].message.content.strip()

        # Clean up markdown code blocks
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_content:
            raw_content = raw_content.split("```")[1].split("```")[0].strip()

        # Extract JSON part
        start_idx = raw_content.find('{')
        if start_idx != -1:
            raw_content = raw_content[start_idx:]
            if raw_content.count('{') == raw_content.count('}') and raw_content.strip().endswith('}'):
                pass
            elif raw_content.rfind('}') > raw_content.rfind('{') and not _is_likely_truncated(raw_content):
                end_idx = raw_content.rfind('}')
                raw_content = raw_content[:end_idx + 1]

        # Attempt parse
        try:
            result = json.loads(raw_content)
        except json.JSONDecodeError:
            logger.warning("[LinkedIn Analyzer] Attempting to repair malformed/truncated JSON...")
            repaired_content = _repair_json(raw_content)
            result = json.loads(repaired_content)

        return _validate_and_normalize(result)

    except Exception as e:
        logger.error(f"[LinkedIn Analyzer] Final failure: {e}")
        try:
            logger.error(f"[LinkedIn Analyzer] Raw content was: {raw_content[:500]}...")
        except Exception:
            pass
        return _fallback_result(f"Analysis error: {str(e)}")


def _is_likely_truncated(content: str) -> bool:
    """Heuristic to check if JSON content ended abruptly."""
    content = content.strip()
    return not (content.endswith('}') or content.endswith(']'))


def _repair_json(content: str) -> str:
    """Robust heuristic to close unclosed JSON structures and handle minor malformations."""
    import re

    content = content.strip()
    if not content.startswith('{'):
        return "{}"

    # Remove trailing unclosed key or partial property
    content = re.sub(r',?\s*\"[^\"]*\"\s*:\s*$', '', content)
    content = re.sub(r',\s*$', '', content)

    # Close open quotes if odd number
    if content.count('"') % 2 != 0:
        content += '"'

    # Stack-based closer for brackets and braces
    stack = []
    in_string = False
    escaped = False

    for char in content:
        if char == '"' and not escaped:
            in_string = not in_string
        elif not in_string:
            if char == '{':
                stack.append('}')
            elif char == '[':
                stack.append(']')
            elif char == '}' or char == ']':
                if stack and stack[-1] == char:
                    stack.pop()

        if char == '\\' and not escaped:
            escaped = True
        else:
            escaped = False

    for closer in reversed(stack):
        content += closer

    return content


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
