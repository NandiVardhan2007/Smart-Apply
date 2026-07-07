import httpx
from typing import List, Dict, Any
from app.config import settings
import logging

logger = logging.getLogger(__name__)

async def search_jobs(query: str, location: str = "us") -> List[Dict[str, Any]]:
    """
    Search for jobs using the JSearch RapidAPI.
    """
    url = "https://jsearch.p.rapidapi.com/search"
    
    # Construct a strong query
    full_query = f"{query} in {location}" if location else query

    querystring = {
        "query": full_query,
        "page": "1",
        "num_pages": "1"
    }

    headers = {
        "x-rapidapi-key": settings.RAPIDAPI_KEY,
        "x-rapidapi-host": "jsearch.p.rapidapi.com"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=querystring)
            response.raise_for_status()
            data = response.json()
            
            # The API returns results in data["data"]
            jobs = data.get("data", [])
            
            # Map to a simpler structure for our app
            formatted_jobs = []
            for job in jobs[:15]: # Limit to top 15
                formatted_jobs.append({
                    "job_id": job.get("job_id"),
                    "title": job.get("job_title"),
                    "company": job.get("employer_name"),
                    "location": job.get("job_city", "") + ", " + job.get("job_country", ""),
                    "description": job.get("job_description", ""),
                    "url": job.get("job_apply_link") or job.get("job_google_link"),
                    "date_posted": job.get("job_posted_at_datetime_utc"),
                    "employment_type": job.get("job_employment_type"),
                    "is_remote": job.get("job_is_remote", False)
                })
            
            return formatted_jobs
    except Exception as e:
        logger.error(f"Error fetching jobs from JSearch: {str(e)}")
        # Return mock data if API fails to prevent breaking the UI entirely
        return []
