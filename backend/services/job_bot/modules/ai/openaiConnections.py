'''
openaiConnections.py — SmartApply
Uses httpx with NVIDIA NIM (OpenAI-compatible) or Gemini as the AI backend.
No `openai` package required — uses only httpx (already in requirements).
'''

import httpx
from config.secrets import *
from config.settings import showAiErrorAlerts
from config.personals import ethnicity, gender, disability_status, veteran_status
from config.questions import *
from config.search import security_clearance, did_masters

from modules.helpers import print_lg, critical_error_log, convert_to_json
from modules.ai.prompts import *

from typing import Literal


apiCheckInstructions = """
1. Make sure your AI API connection details (url, key, model) are correct in config/secrets.py.
2. Check if NVIDIA_API_KEYS / llm_api_key is set in your environment.
ERROR:
"""

# NVIDIA NIM endpoint (OpenAI-compatible) — used as default if llm_api_url is empty
NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"


def ai_error_alert(message: str, stackTrace, title: str = "AI Connection Error") -> None:
    global showAiErrorAlerts
    if showAiErrorAlerts:
        print(f"AI error: {message}")
    critical_error_log(message, stackTrace)


# ── Client is just a simple config dict (no SDK object needed) ────────────────

def ai_create_openai_client() -> dict:
    """
    Returns a config dict for OpenRouter. No SDK client needed.
    """
    try:
        print_lg("Initialising NVIDIA NIM / AI client (httpx) ...")
        if not use_AI:
            raise ValueError("AI is not enabled! Set use_AI = True in config/secrets.py.")
        if not llm_api_key:
            raise ValueError("llm_api_key is empty. Set NVIDIA_API_KEYS in your Render environment variables.")

        client = {
            "api_url":  llm_api_url or NVIDIA_ENDPOINT,
            "api_key":  llm_api_key,
            "model":    llm_model,
        }

        print_lg("---- SUCCESSFULLY CREATED NVIDIA/AI CLIENT (httpx) ----")
        print_lg(f"Using API URL : {client['api_url']}")
        print_lg(f"Using Model   : {client['model']}")
        print_lg("--------------------------------------------------------")
        return client

    except Exception as e:
        ai_error_alert(f"Error creating NVIDIA/AI client. {apiCheckInstructions}", e)
        return None


def ai_close_openai_client(client) -> None:
    """No persistent connection to close for httpx."""
    print_lg("NVIDIA/AI client closed (no-op for httpx).")


# ── Core completion call via httpx ────────────────────────────────────────────

def ai_completion(client: dict, messages: list[dict],
                  response_format: dict = None,
                  temperature: float = 0,
                  stream: bool = False) -> dict | str | None:
    """
    Sends a chat completion request to OpenRouter via httpx.
    Returns the response text (or parsed JSON if response_format given).
    """
    if not client:
        raise ValueError("Client is not available!")

    payload = {
        "model":    client["model"],
        "messages": messages,
        "stream":   False,   # streaming not supported in this httpx implementation
    }
    if response_format:
        payload["response_format"] = response_format

    headers = {
        "Authorization": f"Bearer {client['api_key']}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://smartapply.app",
        "X-Title":       "SmartApply",
    }

    try:
        with httpx.Client(timeout=60) as http:
            resp = http.post(client["api_url"], json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if "error" in data:
            raise ValueError(f"OpenRouter error: {data['error']}")

        result = data["choices"][0]["message"]["content"]

        if response_format:
            result = convert_to_json(result)

        print_lg("\nAI Answer:\n")
        print_lg(result)
        return result

    except httpx.HTTPStatusError as e:
        raise ValueError(f"HTTP {e.response.status_code} from OpenRouter: {e.response.text}") from e
    except Exception as e:
        raise


# ── Public functions (same signatures as before) ──────────────────────────────

def ai_extract_skills(client: dict, job_description: str,
                      stream: bool = False) -> dict | None:
    """Extract skills from job description using OpenRouter."""
    print_lg("-- EXTRACTING SKILLS FROM JOB DESCRIPTION")
    try:
        prompt = extract_skills_prompt.format(job_description)
        messages = [{"role": "user", "content": prompt}]
        return ai_completion(client, messages,
                             response_format=extract_skills_response_format)
    except Exception as e:
        ai_error_alert(f"Error extracting skills. {apiCheckInstructions}", e)


def ai_answer_question(
    client: dict,
    question: str,
    options: list[str] | None = None,
    question_type: Literal['text', 'textarea', 'single_select', 'multiple_select'] = 'text',
    job_description: str = None,
    about_company: str = None,
    user_information_all: str = None,
    stream: bool = False,
) -> str | None:
    """Answer a form question using OpenRouter."""
    print_lg("-- ANSWERING QUESTION using AI (OpenRouter/httpx)")
    try:
        prompt = ai_answer_prompt.format(user_information_all or "N/A", question)
        if job_description and job_description != "Unknown":
            prompt += f"\nJob Description:\n{job_description}"
        if about_company and about_company != "Unknown":
            prompt += f"\nAbout the Company:\n{about_company}"

        messages = [{"role": "user", "content": prompt}]
        print_lg(f"Prompt: {prompt}")
        return ai_completion(client, messages)
    except Exception as e:
        ai_error_alert(f"Error answering question. {apiCheckInstructions}", e)


# ── Stubs (not used but kept for import compatibility) ────────────────────────

def ai_get_models_list(client: dict) -> list:
    return [client.get("model")] if client else []

def model_supports_temperature(model_name: str) -> bool:
    return False

def ai_gen_experience(client, job_description, about_company,
                      required_skills, user_experience, stream=False):
    pass

def ai_generate_resume(client, job_description, about_company,
                       required_skills, stream=False):
    pass

def ai_generate_coverletter(client, job_description, about_company,
                             required_skills, stream=False):
    pass

def ai_evaluate_resume(client, job_description, about_company,
                       required_skills, resume, stream=False):
    pass

def ai_check_job_relevance(client, job_description, about_company,
                           stream=False):
    pass
