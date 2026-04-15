import os
import json
from openai import AsyncOpenAI
from app.core.config import settings

# List of API keys for rotation
API_KEYS = [
    settings.NVIDIA_NIM_KEY_1,
    settings.NVIDIA_NIM_KEY_2,
    settings.NVIDIA_NIM_KEY_3
]
# Filter out None values
API_KEYS = [k for k in API_KEYS if k]

_key_index = 0

def get_next_client():
    global _key_index
    if not API_KEYS:
        raise Exception("No NVIDIA NIM API keys provided in .env")
    
    key = API_KEYS[_key_index]
    _key_index = (_key_index + 1) % len(API_KEYS)
    
    return AsyncOpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=key
    )

async def parse_resume_with_ai(resume_text: str) -> dict:
    """Uses NVIDIA NIM (Llama 3.1 8B) to extract structured data from resume text."""
    # Truncate text to avoid huge context windows and speed up processing
    resume_text = resume_text[:6000]
    
    client = get_next_client()
    
    system_prompt = """Extract profile info from resume. Return ONLY JSON.
    Fields: firstName, lastName, email, phone, location, education, experience, skills.
    Use empty string if not found. No preamble."""

    try:
        response = await client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Resume Text:\n{resume_text}"}
            ],
            temperature=0.1,
            max_tokens=600
        )
        
        raw_content = response.choices[0].message.content
        # Clean up possible markdown code blocks if the AI includes them
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_content:
            raw_content = raw_content.split("```")[1].split("```")[0].strip()
            
        return json.loads(raw_content)
    except Exception as e:
        print(f"AI Parsing Error: {e}")
        return {
            "firstName": "", "lastName": "", "email": "", "phone": "",
            "location": "", "education": "", "experience": "", "skills": ""
        }
