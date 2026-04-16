import io
import logging
from fpdf import FPDF
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class ResumeGenerator:
    """Service to generate ATS-friendly resumes in PDF format."""

    def __init__(self):
        # Using standard fonts which are best for ATS (Helvetica/Arial)
        self.font_main = "Helvetica"
        self.font_bold = "Helvetica-Bold"

    def generate_pdf(self, data: Dict[str, Any]) -> bytes:
        """
        Generates a professional, single-column ATS-friendly PDF.
        data schema:
        {
            "name": "Full Name",
            "contact": {"email": "...", "phone": "...", "location": "...", "linkedin": "...", "portfolio": "..."},
            "summary": "Professional summary...",
            "experience": [{"title": "...", "company": "...", "period": "...", "location": "...", "bullets": ["...", "..."]}],
            "education": [{"degree": "...", "school": "...", "period": "...", "location": "..."}],
            "skills": ["Python", "Golang", "..."]
        }
        """
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        # 1. Header (Name & Contact)
        pdf.set_font(self.font_bold, size=18)
        pdf.cell(0, 10, data.get("name", "RESUME").upper(), ln=True, align='C')
        
        pdf.set_font(self.font_main, size=10)
        contact = data.get("contact", {})
        contact_line = []
        if contact.get("email"): contact_line.append(contact["email"])
        if contact.get("phone"): contact_line.append(contact["phone"])
        if contact.get("location"): contact_line.append(contact["location"])
        
        pdf.cell(0, 6, " | ".join(contact_line), ln=True, align='C')
        
        links = []
        if contact.get("linkedin"): links.append(contact["linkedin"])
        if contact.get("portfolio"): links.append(contact["portfolio"])
        if links:
            pdf.cell(0, 6, " | ".join(links), ln=True, align='C')
            
        pdf.ln(5)

        # 2. Summary
        if data.get("summary"):
            self._add_section_header(pdf, "PROFESSIONAL SUMMARY")
            pdf.set_font(self.font_main, size=11)
            pdf.multi_cell(0, 5, data["summary"])
            pdf.ln(5)

        # 3. Skills
        if data.get("skills"):
            self._add_section_header(pdf, "CORE COMPETENCIES")
            pdf.set_font(self.font_main, size=11)
            skills_text = ", ".join(data["skills"])
            pdf.multi_cell(0, 5, skills_text)
            pdf.ln(5)

        # 4. Experience
        if data.get("experience"):
            self._add_section_header(pdf, "PROFESSIONAL EXPERIENCE")
            for exp in data["experience"]:
                # Title and Dates
                pdf.set_font(self.font_bold, size=11)
                pdf.cell(100, 6, exp.get("title", ""), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 6, exp.get("period", ""), ln=True, align='R')
                
                # Company and Location
                pdf.set_font(self.font_main, style='I', size=11)
                pdf.cell(100, 5, exp.get("company", ""), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 5, exp.get("location", ""), ln=True, align='R')
                
                pdf.ln(2)
                
                # Bullet points
                pdf.set_font(self.font_main, size=10)
                for bullet in exp.get("bullets", []):
                    # Using a simple bullet point character
                    pdf.set_x(15)
                    pdf.cell(5, 5, chr(149), ln=False)
                    pdf.multi_cell(0, 5, bullet)
                pdf.ln(3)

        # 5. Education
        if data.get("education"):
            self._add_section_header(pdf, "EDUCATION")
            for edu in data["education"]:
                pdf.set_font(self.font_bold, size=11)
                pdf.cell(130, 6, edu.get("degree", ""), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 6, edu.get("period", ""), ln=True, align='R')
                
                pdf.set_font(self.font_main, size=11)
                pdf.cell(130, 5, edu.get("school", ""), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 5, edu.get("location", ""), ln=True, align='R')
                pdf.ln(4)

        # Return as bytes
        return pdf.output()

    def _add_section_header(self, pdf: FPDF, title: str):
        pdf.set_font(self.font_bold, size=12)
        pdf.set_fill_color(240, 240, 240) # Light gray background for section headers
        pdf.cell(0, 7, title, ln=True, fill=True)
        pdf.ln(2)

resume_generator = ResumeGenerator()
