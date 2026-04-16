import io
import logging
from fpdf import FPDF
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class ResumeGenerator:
    """Service to generate ATS-friendly resumes in PDF format."""

    def __init__(self):
        # Using standard fonts which are best for ATS (helvetica)
        self.font_main = "helvetica"

    def generate_pdf(self, data: Dict[str, Any], style: str = "standard") -> bytes:
        """
        Generates a professional PDF. Supports 'standard' (ATS-focused) and 'premium' (Visual-focused).
        """
        if style == "premium":
            return self.generate_premium_pdf(data)
            
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        # 1. Header (Name & Contact)
        pdf.set_font(self.font_main, style="B", size=18)
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
                pdf.set_font(self.font_main, style="B", size=11)
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
                pdf.set_font(self.font_main, style="B", size=11)
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

    def generate_premium_pdf(self, data: Dict[str, Any]) -> bytes:
        """
        Generates a premium, visually striking resume.
        Executive Navy/Slate theme.
        """
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        # Colors (Executive Navy)
        primary_color = (44, 62, 80)
        accent_color = (41, 128, 185)
        text_color = (52, 73, 94)
        
        # 1. Premium Header
        pdf.set_fill_color(*primary_color)
        pdf.rect(0, 0, 210, 40, 'F') # Top banner
        
        pdf.set_text_color(255, 255, 255)
        pdf.set_y(10)
        pdf.set_font(self.font_main, style="B", size=24)
        pdf.cell(0, 12, data.get("name", "RESUME").upper(), ln=True, align='C')
        
        pdf.set_font(self.font_main, size=10)
        contact = data.get("contact", {})
        contact_items = []
        if contact.get("email"): contact_items.append(contact["email"])
        if contact.get("phone"): contact_items.append(contact["phone"])
        if contact.get("location"): contact_items.append(contact["location"])
        
        pdf.cell(0, 6, "  |  ".join(contact_items), ln=True, align='C')
        
        if contact.get("linkedin") or contact.get("portfolio"):
            links = []
            if contact.get("linkedin"): links.append(contact["linkedin"])
            if contact.get("portfolio"): links.append(contact["portfolio"])
            pdf.cell(0, 6, "  |  ".join(links), ln=True, align='C')
            
        pdf.set_text_color(*text_color)
        pdf.set_y(45)

        # 2. Key Summary Area
        if data.get("summary"):
            self._add_premium_section_header(pdf, "EXECUTIVE SUMMARY", accent_color)
            pdf.set_font(self.font_main, size=11)
            pdf.multi_cell(0, 5, data["summary"])
            pdf.ln(4)

        # 3. Skills Matrix
        if data.get("skills"):
            self._add_premium_section_header(pdf, "CORE COMPETENCIES & TECHNICAL STACK", accent_color)
            pdf.set_font(self.font_main, size=11)
            # Grouping skills can be done by AI, here we just list them cleanly
            skills_text = " • ".join(data["skills"])
            pdf.multi_cell(0, 5, skills_text)
            pdf.ln(4)

        # 4. Professional Experience
        if data.get("experience"):
            self._add_premium_section_header(pdf, "PROFESSIONAL EXPERIENCE", accent_color)
            for exp in data["experience"]:
                # Title
                pdf.set_font(self.font_main, style="B", size=12)
                pdf.set_text_color(*accent_color)
                pdf.cell(140, 7, exp.get("title", ""), ln=False)
                # Period
                pdf.set_font(self.font_main, size=10)
                pdf.set_text_color(*text_color)
                pdf.cell(0, 7, exp.get("period", ""), ln=True, align='R')
                
                # Company
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(140, 5, exp.get("company", ""), ln=False)
                # Location
                pdf.set_font(self.font_main, style="I", size=10)
                pdf.cell(0, 5, exp.get("location", ""), ln=True, align='R')
                
                pdf.ln(2)
                
                # Bullets
                pdf.set_font(self.font_main, size=10)
                pdf.set_text_color(60, 60, 60)
                for bullet in exp.get("bullets", []):
                    pdf.set_x(15)
                    pdf.set_font("zapfdingbats", size=8)
                    pdf.cell(5, 5, chr(108), ln=False) # Sleek bullet point
                    pdf.set_font(self.font_main, size=10)
                    pdf.multi_cell(0, 5, bullet)
                pdf.ln(3)

        # 5. Education
        if data.get("education"):
            self._add_premium_section_header(pdf, "EDUCATION", accent_color)
            pdf.set_text_color(*text_color)
            for edu in data["education"]:
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(140, 6, edu.get("degree", ""), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 6, edu.get("period", ""), ln=True, align='R')
                
                pdf.set_font(self.font_main, size=10)
                pdf.cell(140, 5, edu.get("school", ""), ln=False)
                pdf.set_font(self.font_main, style="I", size=10)
                pdf.cell(0, 5, edu.get("location", ""), ln=True, align='R')
                pdf.ln(2)

        return pdf.output()

    def _add_premium_section_header(self, pdf: FPDF, title: str, color: tuple):
        pdf.ln(2)
        pdf.set_font(self.font_main, style="B", size=12)
        pdf.set_text_color(*color)
        pdf.cell(0, 8, title, ln=True)
        pdf.set_draw_color(*color)
        pdf.set_line_width(0.5)
        pdf.line(pdf.get_x(), pdf.get_y(), pdf.get_x() + 190, pdf.get_y())
        pdf.ln(3)

    def _add_section_header(self, pdf: FPDF, title: str):
        pdf.set_font(self.font_main, style="B", size=12)
        pdf.set_fill_color(240, 240, 240) # Light gray background for section headers
        pdf.cell(0, 7, title, ln=True, fill=True)
        pdf.ln(2)

resume_generator = ResumeGenerator()
