import base64
import io
import json
import logging
from typing import List
import httpx
import fitz  # PyMuPDF
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import settings

logger = logging.getLogger(__name__)

async def convert_pdf_to_images(pdf_content: bytes) -> List[str]:
    """Convert PDF pages to base64 encoded images."""
    try:
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        images_base64 = []
        for i in range(len(doc)):
            page = doc.load_page(i)
            # High resolution for better OCR
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_bytes = pix.tobytes("png")
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            images_base64.append(b64)
        doc.close()
        return images_base64
    except Exception as e:
        logger.error(f"Failed to convert PDF to images: {e}")
        raise ValueError(f"Failed to process PDF: {str(e)}")

async def extract_latex_from_pdf(pdf_content: bytes) -> str:
    """Use NVIDIA vision model to extract LaTeX from a PDF."""
    if not settings.NVIDIA_IMAGE:
        raise ValueError("NVIDIA_IMAGE is not set.")

    images_base64 = await convert_pdf_to_images(pdf_content)
    if not images_base64:
        raise ValueError("No pages found in the PDF.")
        
    import fitz
    
    # We will process the first page for now, as sending multiple large images 
    # to the API might exceed limits or cause timeouts.
    first_page_b64 = images_base64[0]

    # Extract hyperlinks from the PDF to help the vision model since it can't see embedded URLs
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
        urls_context = "\n\nCRITICAL: The following embedded URLs were found in the original PDF. You MUST use \\href{URL}{text} to re-insert them into the appropriate places in the resume (e.g. project links, portfolio):\n" + "\n".join(f"- {url}" for url in extracted_urls)

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
                        "text": f"""You are an expert LaTeX developer. Convert this resume image into valid, compilable LaTeX code. Output ONLY the raw LaTeX code starting with \\documentclass and ending with \\end{{document}}. Do not wrap it in markdown blocks. Do not add any conversational text.

CRITICAL: You MUST use the EXACT custom commands provided below to structure the resume. Do NOT use standard \\begin{{itemize}} except via the custom commands. Your output MUST fit strictly on ONE PAGE.

Use this EXACT preamble:
\\documentclass[a4paper,11pt]{{article}}
\\usepackage[empty]{{fullpage}}
\\usepackage{{titlesec}}
\\usepackage[usenames,dvipsnames]{{color}}
\\usepackage{{enumitem}}
\\usepackage{{tabularx}}
\\usepackage{{hyperref}}
\\addtolength{{\\oddsidemargin}}{{-0.6in}}
\\addtolength{{\\evensidemargin}}{{-0.5in}}
\\addtolength{{\\textwidth}}{{1.19in}}
\\addtolength{{\\topmargin}}{{-.7in}}
\\addtolength{{\\textheight}}{{1.4in}}
\\raggedbottom
\\raggedright
\\setlength{{\\tabcolsep}}{{0in}}
\\definecolor{{airforceblue}}{{rgb}}{{0.36, 0.54, 0.66}}
\\titleformat{{\\section}}{{\\vspace{{-4pt}}\\scshape\\raggedright\\large\\bfseries}}{{}}{{0em}}{{}}[\\color{{black}}\\titlerule \\vspace{{-5pt}}]
\\newcommand{{\\resumeItem}}[1]{{\\item\\small{{{{#1 \\vspace{{-1pt}}}}}}}}
\\newcommand{{\\resumeSubheading}}[4]{{\\vspace{{-2pt}}\\item\\begin{{tabular*}}{{1.0\\textwidth}}[t]{{l@{{\\extracolsep{{\\fill}}}}r}}\\textbf{{\\large#1}} & \\textbf{{\\small #2}} \\\\ \\textit{{\\large#3}} & \\textit{{\\small #4}} \\\\ \\end{{tabular*}}\\vspace{{-7pt}}}}
\\newcommand{{\\resumeSubHeadingListStart}}{{\\begin{{itemize}}[leftmargin=0.0in, label={{}}]}}
\\newcommand{{\\resumeSubHeadingListEnd}}{{\\end{{itemize}}}}
\\newcommand{{\\resumeItemListStart}}{{\\begin{{itemize}}[leftmargin=0.1in]}}
\\newcommand{{\\resumeItemListEnd}}{{\\end{{itemize}}\\vspace{{-5pt}}}}

CRITICAL RULES FOR CONTENT:
1. For Education and Experience, use \\begin{{itemize}}[leftmargin=0.0in, label={{}}] and \\end{{itemize}}.
2. Inside that list, use \\resumeSubheading{{Title}}{{Location}}{{Role}}{{Dates}} for the main headers. You MUST provide exactly 4 arguments to this macro! If an argument is missing, leave it as empty braces {{}}.
3. For bullet points under a subheading, use \\begin{{itemize}}[leftmargin=0.1in] and \\end{{itemize}}, and use \\resumeItem{{text}} for each bullet.
4. For Projects, Skills, Certifications, and Achievements, do NOT use \\resumeSubheading. Instead, use a simple \\begin{{itemize}}[leftmargin=0.15in] and use \\resumeItem{{text}} for each item.
5. Match the colors (e.g., \\color{{airforceblue}} for section headers).
6. CRITICAL: You MUST escape all LaTeX special characters like &, %, $, _, # by preceding them with a backslash (e.g. \\&, \\%, \\$, \\_, \\#) inside text content.
7. CRITICAL: Do NOT forget the contact information at the very top (under the name). You MUST include the email, phone number, LinkedIn, GitHub, and Portfolio links if they exist in the image. Format them nicely using \\href{{URL}}{{Text}} separated by | or bullets.
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
            
            # Clean up markdown code blocks if the model still adds them
            if content.startswith("```latex"):
                content = content[8:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            return content.strip()
            
    except Exception as e:
        logger.error(f"Failed to extract LaTeX: {e}")
        raise ValueError(f"Failed to extract LaTeX: {str(e)}")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
    reraise=True
)
async def _compile_with_ytotech(latex_code: str) -> bytes:
    """Internal function to compile via ytotech with retries."""
    url = "https://latex.ytotech.com/builds/sync"
    payload = {
        "compiler": "xelatex",
        "resources": [{"main": True, "content": latex_code}]
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.content

async def _compile_with_fallback(latex_code: str, fallback_url: str) -> bytes:
    """Internal function to compile via a generic fallback."""
    # Note: Paid fallback APIs might require different payload structures.
    # This assumes a similar or generic API.
    payload = {
        "compiler": "xelatex",
        "resources": [{"main": True, "content": latex_code}]
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(fallback_url, json=payload)
        response.raise_for_status()
        return response.content

async def compile_latex_to_pdf(latex_code: str) -> bytes:
    """Compile LaTeX to PDF with retries and fallback."""
    try:
        return await _compile_with_ytotech(latex_code)
    except httpx.HTTPStatusError as e:
        error_text = e.response.text
        try:
            err_json = e.response.json()
            if "logs" in err_json:
                error_text = err_json["logs"][-500:]
        except:
            pass
        logger.error(f"LaTeX compilation failed on ytotech: {error_text}")
        
        if settings.LATEX_FALLBACK_URL:
            logger.info("Attempting compilation with fallback URL...")
            try:
                return await _compile_with_fallback(latex_code, settings.LATEX_FALLBACK_URL)
            except Exception as fallback_e:
                logger.error(f"Fallback compilation also failed: {fallback_e}")
                raise ValueError(f"LaTeX compilation failed on both primary and fallback.\nPrimary error: {error_text}")
        
        raise ValueError(f"LaTeX compilation failed:\n{error_text}")
    except Exception as e:
        logger.error(f"Failed to compile LaTeX: {e}")
        
        if settings.LATEX_FALLBACK_URL:
            logger.info("Attempting compilation with fallback URL...")
            try:
                return await _compile_with_fallback(latex_code, settings.LATEX_FALLBACK_URL)
            except Exception as fallback_e:
                logger.error(f"Fallback compilation also failed: {fallback_e}")
                raise ValueError(f"Failed to compile LaTeX on primary and fallback: {str(e)}")
                
        raise ValueError(f"Failed to compile LaTeX: {str(e)}")
