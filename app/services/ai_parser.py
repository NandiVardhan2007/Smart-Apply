import os
import json
import logging
from openai import AsyncOpenAI
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global key rotation system
_keys_str = os.getenv("NVIDIA_NIM_KEYS") or ""
if _keys_str:
    API_KEYS = [k.strip() for k in _keys_str.split(",") if k.strip()]
else:
    # Fallback to individual settings keys
    API_KEYS = [k for k in [settings.NVIDIA_NIM_KEY_1, settings.NVIDIA_NIM_KEY_2, settings.NVIDIA_NIM_KEY_3] if k]

# Client pool
_clients = [
    AsyncOpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=k)
    for k in API_KEYS
] if API_KEYS else []

_key_index = 0

def get_next_client():
    global _key_index
    if not _clients:
        # Fallback to single key if pool is empty
        k = os.getenv("NVIDIA_NIM_KEY") or os.getenv("NVIDIA_NIM_KEY_1")
        if k:
            return AsyncOpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=k)
        raise Exception("No NVIDIA NIM API keys provided")
    
    client = _clients[_key_index]
    _key_index = (_key_index + 1) % len(_clients)
    return client

# Gemini Singleton
gemini_model = None
if settings.GOOGLE_API_KEY:
    try:
        from google import genai
        _genai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        gemini_model = _genai_client.models
    except Exception as e:
        logger.error(f"Failed to initialize Gemini: {e}")

async def parse_resume_with_ai(resume_text: str) -> dict:
    """Uses NVIDIA NIM (Llama 3.1 8B) to extract structured data from resume text."""
    # Truncate text to avoid huge context windows and speed up processing
    resume_text = resume_text[:6000]
    
    system_prompt = """Extract profile info from resume. Return ONLY JSON.
    First, determine if the input text is actually a resume/CV. 
    Fields: 
    isResume: boolean, 
    firstName, lastName, email, phone, current_city, state, country, education, experience, skills, portfolioUrl, linkedinUrl, githubUrl.
    Use empty string if not found. No preamble."""

    # Try up to 3 different keys before giving up on NVIDIA
    max_retries = min(3, len(_clients) if _clients else 3)
    for attempt in range(max_retries):
        try:
            client = get_next_client()
            response = await client.chat.completions.create(
                model="meta/llama-3.1-8b-instruct",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Resume Text:\n{resume_text}"}
                ],
                temperature=0.1,
                max_tokens=600
            )
            break # Success!
        except Exception as e:
            if attempt == max_retries - 1:
                logger.warning(f"All NVIDIA retries failed: {e}. Attempting Gemini Fallback.")
                raise e # Trigger the Gemini fallback below
            logger.info(f"NVIDIA Key failed (Attempt {attempt+1}), rotating to next key...")
    
    try:
        # If we broke out of the loop successfully
        raw_content = response.choices[0].message.content
        # Clean up possible markdown code blocks if the AI includes them
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_content:
            raw_content = raw_content.split("```")[1].split("```")[0].strip()
            
        return json.loads(raw_content)
    except Exception as e:
        logger.warning(f"Primary AI Parsing (NVIDIA) failed: {e}. Attempting Gemini Fallback.")
        
        # --- FALLBACK: GOOGLE GEMINI ---
        if settings.GOOGLE_API_KEY:
            try:
                gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
                
                response = gemini_client.models.generate_content(
                    model="gemini-flash-latest",
                    contents=[types.Content(role="user", parts=[types.Part.from_text(text=f"Resume Text:\n{resume_text}")])],
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.1,
                        candidate_count=1
                    )
                )
                
                raw_content = response.text.strip()
                if "```json" in raw_content:
                    raw_content = raw_content.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_content:
                    raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
                return json.loads(raw_content)
            except Exception as gemini_err:
                logger.error(f"Gemini Parsing Fallback failed: {gemini_err}")

        logger.error(f"AI Parsing CRITICAL FAILURE: Both engines exhausted.")
        return {
            "firstName": "", "lastName": "", "email": "", "phone": "",
            "location": "", "education": "", "experience": "", "skills": "",
            "portfolioUrl": "", "linkedinUrl": "", "githubUrl": ""
        }
