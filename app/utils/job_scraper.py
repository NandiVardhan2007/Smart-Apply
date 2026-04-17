"""
Job Description Scraper Utility
Extracts job description text from common job board URLs.
Handles LinkedIn, Indeed, Glassdoor, Lever, Greenhouse, and generic career pages.
"""

import logging
import re
from typing import Optional, Dict

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Common user-agent to avoid bot blocking
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Maximum characters to return for a job description
MAX_DESCRIPTION_LENGTH = 12000


async def scrape_job_url(url: str) -> Dict[str, str]:
    """
    Scrapes a job posting URL and extracts structured information.

    Returns:
        dict with keys: title, company, description, url
    """
    if not url or not url.startswith("http"):
        return {"title": "", "company": "", "description": "", "url": url or ""}

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=20.0,
            headers=HEADERS
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

        html = response.text
        soup = BeautifulSoup(html, "html.parser")

        # Remove noise elements
        for tag in soup(["script", "style", "nav", "footer", "header", "iframe", "noscript"]):
            tag.decompose()

        title = _extract_title(soup, url)
        company = _extract_company(soup, url)
        description = _extract_description(soup, url)

        if not description or len(description.strip()) < 50:
            # Fallback: grab all visible text
            description = _fallback_text_extraction(soup)

        # Truncate to avoid massive payloads
        description = description[:MAX_DESCRIPTION_LENGTH].strip()

        logger.info(f"[JobScraper] Scraped {url} — title='{title[:60]}', desc_len={len(description)}")

        return {
            "title": title,
            "company": company,
            "description": description,
            "url": url,
        }

    except httpx.HTTPStatusError as e:
        logger.warning(f"[JobScraper] HTTP error scraping {url}: {e.response.status_code}")
        return {"title": "", "company": "", "description": f"Could not access URL (HTTP {e.response.status_code}). Please paste the job description manually.", "url": url}
    except Exception as e:
        logger.error(f"[JobScraper] Error scraping {url}: {e}")
        return {"title": "", "company": "", "description": "Could not scrape this URL. Please paste the job description manually.", "url": url}


def _extract_title(soup: BeautifulSoup, url: str) -> str:
    """Extract job title from the page."""
    # Try meta og:title
    meta_title = soup.find("meta", property="og:title")
    if meta_title and meta_title.get("content"):
        return meta_title["content"].strip()

    # Try the page <title>
    if soup.title and soup.title.string:
        raw = soup.title.string.strip()
        # Clean common suffixes like " | LinkedIn", " - Indeed"
        for sep in [" | ", " - ", " — ", " – "]:
            if sep in raw:
                return raw.split(sep)[0].strip()
        return raw

    # Try first <h1>
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)

    return "Unknown Position"


def _extract_company(soup: BeautifulSoup, url: str) -> str:
    """Extract company name from the page."""
    # Try meta
    meta_company = soup.find("meta", property="og:site_name")
    if meta_company and meta_company.get("content"):
        return meta_company["content"].strip()

    # Try common structured data patterns
    for selector in [
        {"attrs": {"class": re.compile(r"company[-_]?name", re.I)}},
        {"attrs": {"data-testid": re.compile(r"company", re.I)}},
        {"attrs": {"class": re.compile(r"employer", re.I)}},
    ]:
        el = soup.find(**selector)
        if el:
            return el.get_text(strip=True)

    # Lever / Greenhouse pattern
    if "lever.co" in url or "greenhouse.io" in url:
        # Company name is usually in the subdomain
        from urllib.parse import urlparse
        parsed = urlparse(url)
        parts = parsed.hostname.split(".")
        if len(parts) >= 2:
            company = parts[0].replace("-", " ").replace("_", " ").title()
            if company.lower() not in ("www", "jobs", "careers"):
                return company

    return "Unknown Company"


def _extract_description(soup: BeautifulSoup, url: str) -> str:
    """Extract the main job description content."""
    url_lower = url.lower()

    # LinkedIn-specific
    if "linkedin.com" in url_lower:
        desc_el = soup.find("div", class_=re.compile(r"description", re.I))
        if desc_el:
            return desc_el.get_text(separator="\n", strip=True)

    # Indeed-specific
    if "indeed.com" in url_lower:
        desc_el = soup.find("div", id="jobDescriptionText")
        if desc_el:
            return desc_el.get_text(separator="\n", strip=True)

    # Greenhouse-specific
    if "greenhouse.io" in url_lower:
        desc_el = soup.find("div", id="content")
        if desc_el:
            return desc_el.get_text(separator="\n", strip=True)

    # Lever-specific
    if "lever.co" in url_lower:
        desc_el = soup.find("div", class_=re.compile(r"posting-page", re.I))
        if not desc_el:
            desc_el = soup.find("div", class_="content")
        if desc_el:
            return desc_el.get_text(separator="\n", strip=True)

    # Generic: try common selectors
    for selector in [
        {"attrs": {"class": re.compile(r"job[-_]?description", re.I)}},
        {"attrs": {"id": re.compile(r"job[-_]?description", re.I)}},
        {"attrs": {"class": re.compile(r"posting[-_]?body", re.I)}},
        {"attrs": {"class": re.compile(r"description[-_]?content", re.I)}},
        {"attrs": {"role": "main"}},
        {"name": "article"},
        {"name": "main"},
    ]:
        el = soup.find(**selector)
        if el:
            text = el.get_text(separator="\n", strip=True)
            if len(text) > 100:
                return text

    # Meta description as last resort
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        return meta_desc["content"].strip()

    return ""


def _fallback_text_extraction(soup: BeautifulSoup) -> str:
    """Fallback: extract all visible body text."""
    body = soup.find("body")
    if not body:
        return ""

    text = body.get_text(separator="\n", strip=True)

    # Filter out very short lines and deduplicate
    lines = []
    seen = set()
    for line in text.split("\n"):
        line = line.strip()
        if len(line) > 10 and line not in seen:
            lines.append(line)
            seen.add(line)

    return "\n".join(lines)
