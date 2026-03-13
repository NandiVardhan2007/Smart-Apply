"""
resume_parser.py — Local regex-based resume field extractor.
No API key required. Works offline. Handles Indian resume conventions.
"""

import re
import datetime as _dt

MONTH_MAP = {}
for _i, _m in enumerate([
    "jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec",
    "january","february","march","april","may","june","july","august",
    "september","october","november","december"]):
    MONTH_MAP[_m] = (_i % 12) + 1

NOW_YEAR  = _dt.datetime.now().year
NOW_MONTH = _dt.datetime.now().month


def _section_text(text, *headers):
    pattern = "|".join(re.escape(h) for h in headers)
    m = re.search(
        rf"(?im)^[ \t]*(?:{pattern})[ \t]*\n(.*?)(?=\n[ \t]*[A-Z][A-Z &/()\-]{{4,}}[ \t]*\n|\Z)",
        text, re.DOTALL)
    return m.group(1).strip() if m else ""


def _clean(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def _parse_ym(s):
    s = s.strip().lower()
    if s in ("present", "current", "now", "date"):
        return (NOW_YEAR, NOW_MONTH)
    parts = s.split()
    if len(parts) == 2:
        m = MONTH_MAP.get(parts[0], 1)
        try:
            return (int(parts[1]), m)
        except ValueError:
            pass
    return None


def _months_diff(s, e):
    return max(0, (e[0] - s[0]) * 12 + (e[1] - s[1]))


def parse_resume(text):
    lines     = [l.strip() for l in text.splitlines()]
    non_empty = [l for l in lines if l]
    tl        = text.lower()

    result = dict(
        first_name="", middle_name="", last_name="",
        phone_number="", current_city="", state="", country="India",
        linkedin_profile="", website="",
        years_of_experience="0",
        linkedin_headline="", linkedin_summary="",
        cover_letter="", user_information_all="",
        recent_employer="", search_terms=[],
        experience_level=["Entry level"],
        skills_summary="", email="",
    )

    # ── Phone ─────────────────────────────────────────────────────────────
    ph = re.search(r"(?:\+91[\s\-]?)?([6-9]\d{9})", text)
    if ph:
        result["phone_number"] = ph.group(1)[-10:]

    # ── Email ─────────────────────────────────────────────────────────────
    em = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    if em:
        result["email"] = em.group(0)

    # ── LinkedIn ──────────────────────────────────────────────────────────
    li = re.search(r"linkedin\.com/in/([\w\-]+)", text, re.I)
    if li:
        result["linkedin_profile"] = "https://linkedin.com/in/" + li.group(1)

    # ── Website (non-linkedin) ────────────────────────────────────────────
    wb = re.search(r"https?://(?!(?:www\.)?linkedin)([^\s,·|·]+)", text, re.I)
    if wb:
        result["website"] = wb.group(0)

    # ── City ──────────────────────────────────────────────────────────────
    hdr = " ".join(non_empty[:8])
    cm = re.search(r"[·|·]\s*([\w\s]+(?:/[\w\s]+)?)\s*$", hdr)
    if cm:
        result["current_city"] = cm.group(1).strip().split("/")[0].strip()
    if not result["current_city"]:
        cm2 = re.search(
            r"\b(Hyderabad|Bangalore|Bengaluru|Chennai|Mumbai|Delhi|Pune|"
            r"Kolkata|Ahmedabad|Rajahmundry|Vijayawada|Visakhapatnam|"
            r"Coimbatore|Navi Mumbai|Noida|Gurugram|Gurgaon)\b", text, re.I)
        if cm2:
            result["current_city"] = cm2.group(1)

    # ── State ─────────────────────────────────────────────────────────────
    sm = re.search(
        r"\b(Andhra Pradesh|Telangana|Tamil Nadu|Karnataka|Maharashtra|"
        r"Kerala|West Bengal|Gujarat|Rajasthan|Uttar Pradesh|Odisha|Bihar)\b",
        text, re.I)
    if sm:
        result["state"] = sm.group(1)

    # ── Name ──────────────────────────────────────────────────────────────
    # Enhanced name extraction to handle longer Indian names (4-6 words)
    # and filter out common section headers
    SECTION_KEYWORDS = [
        "education", "experience", "skills", "technical", "projects", "certificates",
        "profile", "summary", "objective", "achievements", "awards", "training",
        "internships", "employment", "academic", "professional", "contact",
        "personal", "languages", "interests", "hobbies", "references", "declaration"
    ]
    
    name_line = ""
    for line in non_empty[:10]:
        # Skip lines with special characters, URLs, email indicators
        if any(c in line for c in ["@","·","·","•","▸","+","http","/",":","-","–","—"]):
            continue
        
        # Skip lines that are clearly section headers (common resume keywords)
        if any(kw in line.lower() for kw in SECTION_KEYWORDS):
            continue
        
        # Skip very short or very long lines
        if not (4 <= len(line) <= 70):
            continue
        
        # Match names with 2-6 words (handles longer Indian names)
        # Each word should be 2+ alphabetic characters
        if re.fullmatch(r"[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){1,5}", line):
            name_line = line.strip()
            break

    if name_line:
        parts = name_line.split()
        if name_line == name_line.upper() and len(parts) >= 2:
            # Indian ALL-CAPS format: SURNAME FIRSTNAME → swap
            result["last_name"]   = parts[0].title()
            result["first_name"]  = parts[-1].title()
            result["middle_name"] = " ".join(p.title() for p in parts[1:-1])
        else:
            titled = [p.title() for p in parts]
            result["first_name"]  = titled[0]
            result["last_name"]   = titled[-1] if len(titled) > 1 else ""
            result["middle_name"] = " ".join(titled[1:-1]) if len(titled) > 2 else ""

    # ── Sections ──────────────────────────────────────────────────────────
    summary_text = _section_text(text, "PROFESSIONAL SUMMARY", "SUMMARY", "PROFILE",
                                  "CAREER OBJECTIVE", "OBJECTIVE")
    skills_text  = _section_text(text, "CORE SKILLS", "KEY SKILLS", "SKILLS",
                                  "TECHNICAL SKILLS", "SKILLS & TECHNOLOGIES", "COMPETENCIES")
    exp_text     = _section_text(text, "PROFESSIONAL EXPERIENCE", "WORK EXPERIENCE",
                                  "EXPERIENCE", "EMPLOYMENT HISTORY", "INTERNSHIPS")
    edu_text     = _section_text(text, "EDUCATION", "ACADEMIC BACKGROUND", "ACADEMICS")
    cert_text    = _section_text(text, "CERTIFICATIONS", "CERTIFICATES",
                                  "ACHIEVEMENTS", "AWARDS")

    if summary_text:
        sentences = re.split(r"(?<=[.!?])\s+", _clean(summary_text))
        result["linkedin_summary"] = " ".join(sentences[:2])

    result["skills_summary"] = _clean(skills_text[:700]) if skills_text else ""

    # ── Date ranges → experience ───────────────────────────────────────────
    # Only count date ranges from EXPERIENCE section, not EDUCATION
    date_re = re.compile(
        r"((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"\s+\d{4})\s*[–\-—]+\s*"
        r"(Present|Current|Now|"
        r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"\s+\d{4})", re.I)

    total_months = 0
    # Only parse dates from the EXPERIENCE section, not EDUCATION
    for ss, es in date_re.findall(exp_text):
        s = _parse_ym(ss)
        e = _parse_ym(es)
        if s and e:
            total_months += _months_diff(s, e)

    # < 6 months → "0", 6–17 → "1", else round
    if total_months >= 6:
        result["years_of_experience"] = str(max(1, round(total_months / 12)))
    else:
        result["years_of_experience"] = "0"

    yoe = int(result["years_of_experience"])
    if yoe == 0:
        result["experience_level"] = ["Internship", "Entry level"]
    elif yoe < 3:
        result["experience_level"] = ["Entry level"]
    elif yoe < 6:
        result["experience_level"] = ["Mid-Senior level"]
    else:
        result["experience_level"] = ["Director", "Senior level"]

    # Recent employer
    if exp_text:
        for raw_line in exp_text.splitlines():
            raw_line = raw_line.strip()
            if len(raw_line) < 6:
                continue
            raw_line = re.sub(r"[▸•·]", "", raw_line)
            raw_line = re.split(r"[·\-—]|\bDec\b|\bJan\b|\bMay\b|\d{4}", raw_line)[0]
            cleaned = _clean(raw_line)
            if len(cleaned) > 4:
                result["recent_employer"] = cleaned[:80]
                break

    # ── Headline ──────────────────────────────────────────────────────────
    degree_m = re.search(
        r"(MBA|B\.?Tech|MCA|BCA|B\.?Com|M\.?Tech|B\.?Sc|M\.?Sc|Ph\.?D)"
        r"(?:\s*[-–—(]?\s*([A-Za-z &/]{5,40}))?",
        text, re.I)
    headline_parts = []
    if degree_m:
        headline_parts.append(_clean(degree_m.group(0))[:45])
    for sk in ["CRM","LeadSquared","Excel","Power BI","Python","SQL","Data Analysis",
               "Marketing","Finance","Sales","MIS","Digital Marketing","Operations","HR"]:
        if sk.lower() in tl and sk not in " ".join(headline_parts):
            headline_parts.append(sk)
        if len(headline_parts) >= 5:
            break
    result["linkedin_headline"] = (" | ".join(headline_parts))[:120]

    # ── Search Terms ──────────────────────────────────────────────────────
    term_pool = [
        ("CRM Executive",       ["crm"]),
        ("Business Analyst",    ["business analyst","analysis"]),
        ("Data Analyst",        ["data analysis","power bi","excel","sql"]),
        ("Marketing Analyst",   ["marketing"]),
        ("Inside Sales",        ["inside sales","sales funnel"]),
        ("MIS Analyst",         ["mis","dashboard"]),
        ("Operations Analyst",  ["operations","operational"]),
        ("HR Analyst",          ["hr ","human resource","recruitment"]),
        ("Financial Analyst",   ["finance","financial","valuation"]),
        ("Digital Marketing",   ["digital marketing","sem","seo"]),
        ("Software Developer",  ["python","java","javascript","react","node"]),
        ("ML Engineer",         ["machine learning","deep learning","tensorflow"]),
    ]
    search_terms = []
    for term, kws in term_pool:
        if any(kw in tl for kw in kws):
            search_terms.append(term)
        if len(search_terms) >= 5:
            break
    result["search_terms"] = search_terms

    # ── User Info All ──────────────────────────────────────────────────────
    name_str   = _clean(f"{result['first_name']} {result['middle_name']} {result['last_name']}")
    info_parts = [f"Name: {name_str}"]
    if result["linkedin_headline"]:
        info_parts.append(result["linkedin_headline"])
    if result["skills_summary"]:
        info_parts.append(f"\nSkills:\n{result['skills_summary'][:500]}")
    if edu_text:
        info_parts.append(f"\nEducation:\n{_clean(edu_text)[:300]}")
    if exp_text:
        info_parts.append(f"\nExperience:\n{_clean(exp_text)[:400]}")
    if cert_text:
        info_parts.append(f"\nCertifications:\n{_clean(cert_text)[:200]}")
    result["user_information_all"] = "\n".join(info_parts)[:2500]

    # ── Cover Letter ──────────────────────────────────────────────────────
    fname = result["first_name"]
    lname = result["last_name"]
    role  = search_terms[0] if search_terms else "the open position"
    s_intro = (result["linkedin_summary"] or "a motivated professional")[:220]
    sk_short = _clean(result["skills_summary"])[:150] if result["skills_summary"] else "relevant skills"

    result["cover_letter"] = (
        f"Dear Hiring Manager,\n\n"
        f"I am {fname} {lname}, {s_intro}\n\n"
        f"I am applying for the {role} role at your organisation. "
        f"My key expertise includes {sk_short}.\n\n"
        f"I am an immediate joiner and eager to contribute from day one.\n\n"
        f"Thank you for your time and consideration.\n\nBest regards,\n{fname} {lname}"
    )

    return result


if __name__ == "__main__":
    import json, sys
    from pdfminer.high_level import extract_text as _ext
    if len(sys.argv) < 2:
        print("Usage: python resume_parser.py <resume.pdf>"); sys.exit(1)
    print(json.dumps(parse_resume(_ext(sys.argv[1])), indent=2))
