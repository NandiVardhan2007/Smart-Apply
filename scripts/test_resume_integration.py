import asyncio
import os
import sys

# Add app to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.services.resume_generator import resume_generator

async def test_generation():
    mock_data = {
        "name": "TEST USER",
        "contact": {
            "email": "test@example.com",
            "phone": "555-0199",
            "location": "San Francisco, CA"
        },
        "summary": "Experienced AI engineer with a passion for building autonomous agents.",
        "skills": ["Python", "Machine Learning", "FastAPI", "DevOps"],
        "experience": [
            {
                "title": "Senior AI Developer",
                "company": "Tech Corp",
                "period": "2020 - Present",
                "location": "Remote",
                "bullets": ["Led development of Jarvis agent.", "Optimized inference speed by 40%."]
            }
        ],
        "education": [
            {
                "degree": "B.S. Computer Science",
                "school": "State University",
                "period": "2016 - 2020",
                "location": "City, ST"
            }
        ]
    }

    styles = ["executive_gold", "minimalist_sleek", "standard"]
    
    for style in styles:
        print(f"Testing style: {style}...")
        res = resume_generator.generate_pdf(mock_data, style=style)
        if res and len(res) > 0:
            ext = "docx" if style == "executive_gold" or style == "minimalist_sleek" else "pdf"
            filename = f"test_resume_{style}.{ext}"
            with open(filename, "wb") as f:
                f.write(res)
            print(f"  Success: Generated {filename} ({len(res)} bytes)")
        else:
            print(f"  FAILED: No data returned for style {style}")

if __name__ == "__main__":
    asyncio.run(test_generation())
