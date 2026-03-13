##> ------ Rewritten to use httpx instead of openai SDK ------
from config.secrets import *
from config.settings import showAiErrorAlerts
from modules.helpers import print_lg, critical_error_log, convert_to_json
from modules.ai.prompts import *

import httpx
from typing import Literal


def deepseek_create_client() -> dict | None:
    '''
    Creates a DeepSeek/OpenRouter client config dict using httpx.
    No openai SDK required.
    '''
    try:
        print_lg("Creating DeepSeek/OpenRouter client (httpx)...")
        if not use_AI:
            raise ValueError("AI is not enabled! Set use_AI = True in config/secrets.py.")

        base_url = (llm_api_url or "").rstrip("/")

        client = {
            "api_url": base_url,
            "api_key": llm_api_key,
            "model":   llm_model,
        }

        print_lg("---- SUCCESSFULLY CREATED DEEPSEEK CLIENT (httpx) ----")
        print_lg(f"Using API URL: {base_url}")
        print_lg(f"Using Model: {llm_model}")
        print_lg("------------------------------------------------------")
        return client

    except Exception as e:
        critical_error_log("Error creating DeepSeek client.", e)
        return None


def deepseek_model_supports_temperature(model_name: str) -> bool:
    return model_name in ["deepseek-chat", "deepseek-reasoner"]


def deepseek_completion(client: dict, messages: list[dict],
                        response_format: dict = None,
                        temperature: float = 0,
                        stream: bool = False) -> dict | str | None:
    '''
    Calls DeepSeek/OpenRouter API via httpx and returns the response.
    '''
    if not client:
        raise ValueError("DeepSeek client is not available!")

    payload = {
        "model":    client["model"],
        "messages": messages,
        "stream":   False,
    }
    if deepseek_model_supports_temperature(client["model"]):
        payload["temperature"] = temperature
    if response_format:
        payload["response_format"] = response_format

    headers = {
        "Authorization": f"Bearer {client['api_key']}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://smartapply.app",
        "X-Title":       "SmartApply",
    }

    try:
        print_lg(f"Calling DeepSeek API via httpx, model: {client['model']}")
        with httpx.Client(timeout=60) as http:
            resp = http.post(client["api_url"], json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if "error" in data:
            raise ValueError(f"API error: {data['error']}")

        result = data["choices"][0]["message"]["content"]

        if response_format:
            result = convert_to_json(result)

        print_lg("\nDeepSeek Answer:\n")
        print_lg(result)
        return result

    except httpx.HTTPStatusError as e:
        if "401" in str(e):
            print_lg("Authentication error — check your API key.")
        elif "429" in str(e):
            print_lg("Rate limit exceeded — wait before retrying.")
        raise ValueError(f"DeepSeek API HTTP error: {e.response.status_code} — {e.response.text}") from e
    except Exception as e:
        raise ValueError(f"DeepSeek API error: {e}") from e


def deepseek_extract_skills(client: dict, job_description: str,
                             stream: bool = False) -> dict | None:
    '''Extract skills from job description using DeepSeek/OpenRouter.'''
    try:
        print_lg("Extracting skills from job description using DeepSeek...")
        prompt = deepseek_extract_skills_prompt.format(job_description)
        messages = [{"role": "user", "content": prompt}]
        result = deepseek_completion(client, messages,
                                     response_format={"type": "json_object"})
        if isinstance(result, str):
            result = convert_to_json(result)
        return result
    except Exception as e:
        critical_error_log("Error extracting skills with DeepSeek!", e)
        return {"error": str(e)}


def deepseek_answer_question(
    client: dict,
    question: str,
    options: list[str] | None = None,
    question_type: Literal['text', 'textarea', 'single_select', 'multiple_select'] = 'text',
    job_description: str = None,
    about_company: str = None,
    user_information_all: str = None,
    stream: bool = False,
) -> str | None:
    '''Answer a form question using DeepSeek/OpenRouter via httpx.'''
    try:
        print_lg(f"Answering question using DeepSeek: {question}")
        prompt = ai_answer_prompt.format(user_information_all or "", question)

        if options and question_type in ['single_select', 'multiple_select']:
            options_str = "OPTIONS:\n" + "\n".join([f"- {o}" for o in options])
            prompt += f"\n\n{options_str}"
            if question_type == 'single_select':
                prompt += "\n\nPlease select exactly ONE option from the list above."
            else:
                prompt += "\n\nYou may select MULTIPLE options from the list above if appropriate."

        if job_description:
            prompt += f"\n\nJOB DESCRIPTION:\n{job_description}"
        if about_company:
            prompt += f"\n\nABOUT COMPANY:\n{about_company}"

        messages = [{"role": "user", "content": prompt}]
        return deepseek_completion(client, messages, temperature=0.1)

    except Exception as e:
        critical_error_log("Error answering question with DeepSeek!", e)
        return {"error": str(e)}
##<
