import base64
import io
import json
import logging
from typing import List
import httpx
import re
import fitz  # PyMuPDF
from app.config import settings
from app.services.latex_service import convert_pdf_to_images

logger = logging.getLogger(__name__)

async def extract_html_from_pdf(pdf_content: bytes) -> str:
    """Use NVIDIA vision model to extract a styled HTML resume from a PDF."""
    if not settings.NVIDIA_IMAGE:
        raise ValueError("NVIDIA_IMAGE is not set.")

    images_base64 = await convert_pdf_to_images(pdf_content)
    if not images_base64:
        raise ValueError("No pages found in the PDF.")
        
    # We will process the first page for now
    first_page_b64 = images_base64[0]

    # Extract hyperlinks from the PDF
    extracted_urls = set()
    try:
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        for page in doc:
            for link in page.get_links():
                if "uri" in link:
                    extracted_urls.add(link["uri"])
    except Exception as e:
        logger.warning(f"Failed to extract links from PDF: {e}")
        
    urls_context = ""
    if extracted_urls:
        urls_context = "\n\nCRITICAL: The following embedded URLs were found in the original PDF. You MUST use <a href='URL'>text</a> to re-insert them into the appropriate places in the resume:\n" + "\n".join(f"- {url}" for url in extracted_urls)

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_IMAGE}",
        "Accept": "application/json",
    }
    
    # Payload for Llama 3.2 vision (OpenAI compatible)
    payload = {
        "model": settings.NVIDIA_IMAGE_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text", 
                        "text": f"""You are an expert Frontend Developer and Designer. Convert this resume image into a fully styled, self-contained HTML document. Output ONLY the raw HTML code starting with <!DOCTYPE html> and ending with </html>. Do not wrap it in markdown blocks. Do not add any conversational text.

CRITICAL: You MUST use the provided CSS template below and modify it as needed to perfectly recreate the visual layout, typography, density, margins, and bolding of the provided resume image. DO NOT just dump plain text into a single div. 

CRITICAL HTML/CSS RULES:
1. The root element MUST be `<div class="resume-page">`.
2. Use `<div class="header">` for the top name/contact section. Use flexbox to align left/right content perfectly.
3. Use `<div class="section">` for each section. Use `<div class="section-title">` for section headers with a bottom border to match the image.
4. For Education and Experience, use flexbox `<div class="entry-header">` to put Title on left and Dates on right, and `<div class="entry-sub">` to put Role on left and Location on right.
5. For bullet points, use `<ul class="compact-list">` with heavily reduced margins (`margin: 2px 0; padding-left: 15px;`) to match the extreme density of the original PDF.
6. Make sure skill lists are properly bolded inline like `<b>Languages:</b> C, C++, Java`.

BASE CSS TEMPLATE (Inject this into your <style> block and expand it):
```css
body {{ background-color: #f0f0f0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 20px; }}
.resume-page {{ width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 15mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.1); font-size: 11pt; line-height: 1.3; }}
@media print {{ body, html {{ background: white; padding: 0; margin: 0; }} .resume-page {{ width: 100%; height: auto; min-height: 100%; padding: 10mm; margin: 0; box-shadow: none; }} }}
.header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; border-bottom: 2px solid #2c3e50; padding-bottom: 8px; }}
.header-name {{ font-size: 24pt; font-weight: bold; color: #2c3e50; margin: 0; }}
.header-contact {{ font-size: 10pt; text-align: right; }}
.header-contact a {{ color: #2c3e50; text-decoration: none; }}
.section {{ margin-bottom: 12px; }}
.section-title {{ font-size: 13pt; font-weight: bold; color: #2c3e50; border-bottom: 1px solid #2c3e50; margin-bottom: 6px; padding-bottom: 2px; text-transform: uppercase; }}
.entry-header {{ display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px; font-size: 11.5pt; }}
.entry-sub {{ display: flex; justify-content: space-between; font-style: italic; margin-bottom: 4px; font-size: 10.5pt; }}
.compact-list {{ margin: 0; padding-left: 20px; }}
.compact-list li {{ margin-bottom: 2px; }}
p {{ margin: 0 0 8px 0; }}
```
{urls_context}"""
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{first_page_b64}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 4096,
        "temperature": 0.2,
        "top_p": 0.7
    }

    url = f"{settings.NVIDIA_BASE_URL}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            # Extract only the HTML content using regex
            match = re.search(r'(<!DOCTYPE html>.*</html>)', content, re.IGNORECASE | re.DOTALL)
            if match:
                content = match.group(1)
            else:
                # Fallback: try to find just <html> tags
                match = re.search(r'(<html.*?>.*</html>)', content, re.IGNORECASE | re.DOTALL)
                if match:
                    content = match.group(1)
                else:
                    # Clean up markdown code blocks if no clear root tags found
                    content = re.sub(r'^```html\s*', '', content)
                    content = re.sub(r'^```\s*', '', content)
                    content = re.sub(r'```\s*$', '', content)
            
            return content.strip()
            
    except Exception as e:
        logger.error(f"Failed to extract HTML: {e}")
        raise ValueError(f"Failed to extract HTML: {str(e)}")
