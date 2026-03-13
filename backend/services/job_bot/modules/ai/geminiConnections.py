import google.generativeai as genai
from config.secrets import llm_model, llm_api_key
from config.settings import showAiErrorAlerts
from modules.helpers import print_lg, critical_error_log, convert_to_json
from modules.ai.prompts import *

from typing import Literal

def gemini_get_models_list():
    """
    Lists available Gemini models that support content generation.
    """
    try:
        print_lg("Getting Gemini models list...")
        models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        print_lg("Available models:")
        for model in models:
            print_lg(f"- {model}")
        return models
    except Exception as e:
        critical_error_log("Error occurred while getting Gemini models list!", e)
        return ["error", e]

def gemini_create_client():
    """
    Configures the Gemini client and validates the selected model.
    * Returns a configured Gemini model object or None if an error occurs.
    """
    try:
        print_lg("Configuring Gemini client...")
        if not llm_api_key or "YOUR_API_KEY" in llm_api_key:
            raise ValueError("Gemini API key is not set. Please set it in `config/secrets.py`.")
        
        genai.configure(api_key=llm_api_key)
        
        models = gemini_get_models_list()
        if "error" in models:
            raise ValueError(models[1])
        if not any(llm_model in m for m in models):
             raise ValueError(f"Model `{llm_model}` is not found or not available for content generation!")

        model = genai.GenerativeModel(llm_model)
        
        print_lg("---- SUCCESSFULLY CONFIGURED GEMINI CLIENT! ----")
        print_lg(f"Using Model: {llm_model}")
        print_lg("Check './config/secrets.py' for more details.\n")
        print_lg("---------------------------------------------")
        
        return model
    except Exception as e:
        global showAiErrorAlerts
        error_message = f"Error occurred while configuring Gemini client. Make sure your API key and model name are correct."
        critical_error_log(error_message, e)
        if showAiErrorAlerts:
            print(f"AI error: {error_message}")
        return None

def gemini_completion(model, prompt: str, is_json: bool = False) -> dict | str:
    """
    Generates content using the Gemini model.
    * Takes in `model` - The Gemini model object.
    * Takes in `prompt` of type `str` - The prompt to send to the model.
    * Takes in `is_json` of type `bool` - Whether to expect a JSON response.
    * Returns the response as a string or a dictionary.
    """
    if not model:
        raise ValueError("Gemini client is not available!")

    import re as _re, time as _time

    _MAX_RETRIES = 3

    for _attempt in range(_MAX_RETRIES):
        try:
            # The Gemini API has a 'safety_settings' parameter to control content filtering.
            # For a job application helper, it's generally safe to set these to a less restrictive level
            # to avoid blocking legitimate content from resumes or job descriptions.
            safety_settings = [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_NONE",
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_NONE",
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE",
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE",
                },
            ]

            print_lg(f"Calling Gemini API for completion...")
            response = model.generate_content(prompt, safety_settings=safety_settings)
            
            # The response might be blocked. Check for that.
            if not response.parts:
                 raise ValueError("The response from the Gemini API was empty. This might be due to the safety filters blocking the prompt or the response. The prompt was:\n" + prompt)

            result = response.text

            if is_json:
                # Clean the response to remove Markdown formatting
                if result.startswith("```json"):
                    result = result[7:]
                if result.endswith("```"):
                    result = result[:-3]
                
                return convert_to_json(result)
            
            return result

        except Exception as e:
            err_str = str(e)
            # Handle rate-limit / quota errors with automatic retry
            if '429' in err_str or 'quota' in err_str.lower() or 'rate' in err_str.lower():
                # Try to extract retry_delay seconds from the error message
                wait_secs = 60  # default
                match = _re.search(r'retry_delay\s*\{[^}]*seconds:\s*(\d+)', err_str)
                if match:
                    wait_secs = int(match.group(1)) + 5  # add buffer
                if _attempt < _MAX_RETRIES - 1:
                    print_lg(f"Gemini rate-limited (429). Waiting {wait_secs}s before retry {_attempt+2}/{_MAX_RETRIES}...")
                    _time.sleep(wait_secs)
                    continue
            critical_error_log(f"Error occurred while getting Gemini completion!", e)
            return {"error": str(e)}

def gemini_extract_skills(model, job_description: str) -> list[str] | None:
    """
    Extracts skills from a job description using the Gemini model.
    * Takes in `model` - The Gemini model object.
    * Takes in `job_description` of type `str`.
    * Returns a `dict` object representing JSON response.
    """
    try:
        print_lg("Extracting skills from job description using Gemini...")
        prompt = extract_skills_prompt.format(job_description) + "\n\nImportant: Respond with only the JSON object, without any markdown formatting or other text."
        return gemini_completion(model, prompt, is_json=True)
    except Exception as e:
        critical_error_log("Error occurred while extracting skills with Gemini!", e)
        return {"error": str(e)}

def gemini_answer_question(
    model,
    question: str, options: list[str] | None = None, 
    question_type: Literal['text', 'textarea', 'single_select', 'multiple_select'] = 'text', 
    job_description: str = None, about_company: str = None, user_information_all: str = None
) -> str:
    """
    Answers a question using the Gemini API.
    """
    try:
        print_lg(f"Answering question using Gemini AI: {question}")
        user_info = user_information_all or ""
        prompt = ai_answer_prompt.format(user_info, question)

        if options and (question_type in ['single_select', 'multiple_select']):
            options_str = "OPTIONS:\n" + "\n".join([f"- {option}" for option in options])
            prompt += f"\n\n{options_str}"
            if question_type == 'single_select':
                prompt += "\n\nPlease select exactly ONE option from the list above."
            else:
                prompt += "\n\nYou may select MULTIPLE options from the list above if appropriate."
        
        if job_description:
            prompt += f"\n\nJOB DESCRIPTION:\n{job_description}"
        
        if about_company:
            prompt += f"\n\nABOUT COMPANY:\n{about_company}"

        return gemini_completion(model, prompt)
    except Exception as e:
        critical_error_log("Error occurred while answering question with Gemini!", e)
        return {"error": str(e)}