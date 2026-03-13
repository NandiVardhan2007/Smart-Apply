'''
External Job Application Form Auto-Filler
Automatically detects and fills common fields on external job application pages.
'''

import os
import time
import json
import urllib.request
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from modules.helpers import print_lg, buffer, sleep

# ─── Field mapping: label keywords → config values ───────────────────────────
# Populated at runtime with values from config
_profile: dict = {}

def load_profile(
    first_name, middle_name, last_name, phone_number,
    current_city, street, state, zipcode, country,
    email, linkedin_profile, website,
    desired_salary, current_ctc, notice_period,
    years_of_experience, cover_letter, linkedin_headline,
    linkedin_summary, user_information_all, default_resume_path,
    require_visa, us_citizenship, recent_employer, confidence_level,
    **kwargs
):
    '''Load user profile data into the filler. Call once at startup.'''
    global _profile
    full_name = (first_name + " " + middle_name + " " + last_name).strip() if middle_name else first_name + " " + last_name
    _profile = {
        "first_name": first_name,
        "middle_name": middle_name,
        "last_name": last_name,
        "full_name": full_name,
        "phone": phone_number,
        "phone_number": phone_number,
        "city": current_city,
        "current_city": current_city,
        "street": street,
        "state": state,
        "zipcode": zipcode,
        "zip": zipcode,
        "postal": zipcode,
        "country": country,
        "email": email,
        "linkedin": linkedin_profile,
        "linkedin_profile": linkedin_profile,
        "website": website,
        "portfolio": website,
        "salary": str(desired_salary),
        "expected_salary": str(desired_salary),
        "desired_salary": str(desired_salary),
        "current_ctc": str(current_ctc),
        "notice_period": str(notice_period),
        "years_of_experience": str(years_of_experience),
        "experience": str(years_of_experience),
        "cover_letter": cover_letter,
        "summary": linkedin_summary,
        "headline": linkedin_headline,
        "about": user_information_all,
        "resume_path": default_resume_path,
        "visa": require_visa,
        "citizenship": us_citizenship,
        "employer": recent_employer,
        "company": recent_employer,
    }




# Gemini API key loaded from secrets at runtime
_gemini_api_key: str = ""

def set_gemini_key(api_key: str):
    """Set the Gemini API key for AI-powered answers."""
    global _gemini_api_key
    _gemini_api_key = api_key


def _ai_answer(question: str, context: str = "") -> str | None:
    """Use Gemini to answer a tricky form question. Returns answer string or None."""
    if not _gemini_api_key:
        return None
    try:
        prompt = f"""You are filling out a job application form for this candidate:
{context}

Answer this form question concisely and professionally (1-2 sentences max, no preamble):
{question}"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={_gemini_api_key}"
        body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        print_lg(f"AI answer failed: {e}")
        return None

def _match_label(label: str) -> str | None:
    '''Map a form label to a profile value using keyword matching.'''
    label = label.lower().strip()

    # Name fields
    if any(x in label for x in ["first name", "firstname", "given name"]):
        return _profile.get("first_name")
    if any(x in label for x in ["last name", "lastname", "surname", "family name"]):
        return _profile.get("last_name")
    if any(x in label for x in ["middle name", "middlename"]):
        return _profile.get("middle_name")
    if any(x in label for x in ["full name", "fullname", "your name", "candidate name", "applicant name", "name"]):
        return _profile.get("full_name")

    # Contact
    if any(x in label for x in ["email", "e-mail", "mail id"]):
        return _profile.get("email")
    if any(x in label for x in ["phone", "mobile", "contact number", "cell"]):
        return _profile.get("phone")

    # Location
    if any(x in label for x in ["street", "address line 1", "address1"]):
        return _profile.get("street")
    if any(x in label for x in ["city", "town", "location", "current location"]):
        return _profile.get("city")
    if any(x in label for x in ["state", "province", "region"]):
        return _profile.get("state")
    if any(x in label for x in ["zip", "postal", "pin code", "pincode"]):
        return _profile.get("zipcode")
    if "country" in label:
        return _profile.get("country")

    # Professional
    if any(x in label for x in ["linkedin", "linked in"]):
        return _profile.get("linkedin")
    if any(x in label for x in ["portfolio", "website", "personal url", "github"]):
        return _profile.get("website")
    if any(x in label for x in ["cover letter", "coverletter", "why do you want", "why are you interested"]):
        return _profile.get("cover_letter")
    if any(x in label for x in ["headline", "professional headline"]):
        return _profile.get("headline")
    if any(x in label for x in ["summary", "about yourself", "about you", "tell us about", "profile summary", "professional summary"]):
        return _profile.get("summary")
    if any(x in label for x in ["years of experience", "years experience", "total experience", "work experience"]):
        return _profile.get("years_of_experience")
    if any(x in label for x in ["notice period", "joining time", "availability"]):
        return _profile.get("notice_period")
    if any(x in label for x in ["current ctc", "current salary", "current compensation"]):
        return _profile.get("current_ctc")
    if any(x in label for x in ["expected ctc", "expected salary", "desired salary", "salary expectation"]):
        return _profile.get("salary")
    if any(x in label for x in ["current employer", "current company", "recent employer", "present employer"]):
        return _profile.get("employer")
    if any(x in label for x in ["visa", "work authorization", "work permit"]):
        return _profile.get("visa")
    return None


def _get_label_text(driver: WebDriver, field: WebElement) -> str:
    '''Try to extract label text for a given input field.'''
    label_text = ""
    try:
        field_id = field.get_attribute("id")
        if field_id:
            try:
                label_el = driver.find_element(By.XPATH, f'.//label[@for="{field_id}"]')
                label_text = label_el.text.strip()
                if label_text:
                    return label_text
            except Exception:
                pass

        # Try aria-label
        label_text = field.get_attribute("aria-label") or ""
        if label_text:
            return label_text.strip()

        # Try placeholder
        label_text = field.get_attribute("placeholder") or ""
        if label_text:
            return label_text.strip()

        # Try name attribute
        label_text = field.get_attribute("name") or ""
        return label_text.strip()

    except Exception:
        return label_text


def _fill_text_field(field: WebElement, value: str) -> bool:
    '''Clear and fill a text/textarea input.'''
    try:
        field.click()
        sleep(0.2)
        field.send_keys(Keys.CONTROL + "a")
        field.send_keys(Keys.DELETE)
        field.send_keys(value)
        return True
    except Exception as e:
        print_lg(f"Failed to fill text field: {e}")
        return False


def _fill_select_field(field: WebElement, value: str) -> bool:
    '''Try to select closest matching option in a <select> dropdown.'''
    try:
        sel = Select(field)
        value_lower = value.lower()
        # Try exact match first
        for opt in sel.options:
            if opt.text.strip().lower() == value_lower:
                sel.select_by_visible_text(opt.text.strip())
                return True
        # Try partial match
        for opt in sel.options:
            if value_lower in opt.text.strip().lower():
                sel.select_by_visible_text(opt.text.strip())
                return True
        return False
    except Exception as e:
        print_lg(f"Failed to fill select field: {e}")
        return False


def _upload_resume(driver: WebDriver, field: WebElement, resume_path: str) -> bool:
    '''Upload resume to a file input field.'''
    try:
        abs_path = os.path.abspath(resume_path)
        if os.path.exists(abs_path):
            field.send_keys(abs_path)
            print_lg(f"Uploaded resume: {abs_path}")
            return True
        else:
            print_lg(f"Resume file not found at: {abs_path}")
            return False
    except Exception as e:
        print_lg(f"Failed to upload resume: {e}")
        return False


def fill_external_form(driver: WebDriver, url: str) -> bool:
    '''
    Main function: attempts to auto-fill an external job application form.
    Opens URL in the current tab (assumed already open), scans for fields, fills them.
    Returns True if any fields were filled.
    '''
    if not _profile:
        print_lg("External form filler: profile not loaded, skipping.")
        return False

    print_lg(f"\n[External Form Filler] Attempting to fill form at: {url}")
    filled_count = 0

    try:
        # Wait for page to fully load
        WebDriverWait(driver, 15).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        time.sleep(2)

        # ── Text & Textarea inputs ────────────────────────────────────────────
        text_fields = driver.find_elements(
            By.XPATH,
            './/input[@type="text" or @type="email" or @type="tel" or @type="number" or @type="url" or not(@type)] | .//textarea'
        )
        for field in text_fields:
            try:
                if not field.is_displayed() or not field.is_enabled():
                    continue
                label = _get_label_text(driver, field)
                if not label:
                    continue
                value = _match_label(label)
                if not value and _gemini_api_key and len(label) > 5:
                    # AI fallback for unrecognised questions
                    context = _profile.get("about", "") + "\n" + _profile.get("summary", "")
                    value = _ai_answer(label, context)
                    if value:
                        print_lg(f"  🤖 AI answered '{label}' → '{value[:60]}'")
                if value:
                    if _fill_text_field(field, value):
                        if "🤖" not in str(value):
                            print_lg(f"  ✓ Filled '{label}' → '{value[:60]}'")
                        filled_count += 1
                        buffer(1)
            except Exception:
                continue

        # ── Select dropdowns ──────────────────────────────────────────────────
        select_fields = driver.find_elements(By.TAG_NAME, 'select')
        for field in select_fields:
            try:
                if not field.is_displayed() or not field.is_enabled():
                    continue
                label = _get_label_text(driver, field)
                if not label:
                    continue
                value = _match_label(label)
                if value:
                    if _fill_select_field(field, value):
                        print_lg(f"  ✓ Selected '{label}' → '{value[:60]}'")
                        filled_count += 1
                        buffer(1)
            except Exception:
                continue

        # ── File inputs (resume upload) ───────────────────────────────────────
        file_fields = driver.find_elements(By.XPATH, './/input[@type="file"]')
        for field in file_fields:
            try:
                label = _get_label_text(driver, field)
                label_lower = label.lower()
                # Only upload to resume/cv fields, not cover letter or photo
                if any(x in label_lower for x in ["resume", "cv", "curriculum vitae", "upload your"]):
                    resume_path = _profile.get("resume_path", "")
                    if resume_path and _upload_resume(driver, field, resume_path):
                        filled_count += 1
                        buffer(1)
            except Exception:
                continue

        if filled_count > 0:
            print_lg(f"[External Form Filler] Successfully filled {filled_count} field(s). Please review before submitting.")
        else:
            print_lg("[External Form Filler] No matching fields found on this page.")

        return filled_count > 0

    except Exception as e:
        print_lg(f"[External Form Filler] Error while filling form: {e}")
        return False