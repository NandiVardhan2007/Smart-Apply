import os
import json
from openai import OpenAI
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
    
    return OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=key
    )

async def parse_resume_with_ai(resume_text: str) -> dict:
    """Uses NVIDIA NIM (Llama 3.1 Nemotron 70B) to extract structured data from resume text."""
    client = get_next_client()
    
    system_prompt = """
    You are an expert HR assistant. Your task is to extract profile information from a candidate's resume text.
    Return ONLY a valid JSON object with the following fields:
    {
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phone": "string",
      "location": "string",
      "education": "Brief summary of education (e.g. Master's in CS, Stanford)",
      "experience": "Brief summary of key work experience (e.g. 5+ years in Web Development)",
      "skills": "Comma separated list of key skills"
    }
    If a field is not found, use an empty string. Do not include any other text in your response.
    """

    try:
        response = client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract info from this resume:\n\n{resume_text}"}
            ],
            temperature=0.2,
            max_tokens=1024
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
