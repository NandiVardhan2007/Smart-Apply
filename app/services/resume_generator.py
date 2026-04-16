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

    def _sanitize_text(self, text: Any) -> str:
        """
        Converts text to Latin-1 compatible string, replacing unsupported characters.
        This prevents UnicodeEncodeError when using core PDF fonts (Helvetica).
        """
        if text is None:
            return ""
        if not isinstance(text, str):
            text = str(text)
            
        # Common AI characters and their ASCII equivalents
        replacements = {
            "\u2013": "-", # en dash
            "\u2014": "-", # em dash
            "\u2018": "'", # left single quote
            "\u2019": "'", # right single quote
            "\u201c": '"', # left double quote
            "\u201d": '"', # right double quote
            "\u2022": "-", # bullet point
            "\u200b": "",  # zero width space
            "\u2713": "check", # checkmark
            "\u26a1": "fast",  # lightning
        }
        
        for unicode_char, ascii_char in replacements.items():
            text = text.replace(unicode_char, ascii_char)
            
        # Encode to latin-1, ignore remaining errors
        return text.encode('latin-1', 'replace').decode('latin-1')

    def generate_pdf(self, data: Dict[str, Any], style: str = "standard") -> bytes:
        """
        Generates a professional PDF. Supports 'standard' (ATS-focused) and 'premium' (Visual-focused).
        """
        if style == "premium":
            return self.generate_premium_pdf(data)
        if style == "creative":
            return self.generate_creative_pdf(data)
        if style == "minimalist":
            return self.generate_minimalist_pdf(data)
        if style == "startup":
            return self.generate_startup_pdf(data)
        if style == "academic":
            return self.generate_academic_pdf(data)
            
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        # 1. Header (Name & Contact)
        pdf.set_font(self.font_main, style="B", size=18)
        name = self._sanitize_text(data.get("name", "RESUME"))
        pdf.cell(0, 10, name.upper(), ln=True, align='C')
        
        pdf.set_font(self.font_main, size=10)
        contact = data.get("contact", {})
        contact_line = []
        if contact.get("email"): contact_line.append(contact["email"])
        if contact.get("phone"): contact_line.append(contact["phone"])
        if contact.get("location"): contact_line.append(contact["location"])
        
        pdf.cell(0, 6, self._sanitize_text(" | ".join(contact_line)), ln=True, align='C')
        
        links = []
        if contact.get("linkedin"): links.append(contact["linkedin"])
        if contact.get("portfolio"): links.append(contact["portfolio"])
        if links:
            pdf.cell(0, 6, self._sanitize_text(" | ".join(links)), ln=True, align='C')
            
        pdf.ln(5)

        # 2. Summary
        if data.get("summary"):
            self._add_section_header(pdf, "PROFESSIONAL SUMMARY")
            pdf.set_font(self.font_main, size=11)
            pdf.multi_cell(0, 5, self._sanitize_text(data["summary"]))
            pdf.ln(5)

        # 3. Skills
        if data.get("skills"):
            self._add_section_header(pdf, "CORE COMPETENCIES")
            pdf.set_font(self.font_main, size=11)
            skills_text = self._sanitize_text(", ".join(data["skills"]))
            pdf.multi_cell(0, 5, skills_text)
            pdf.ln(5)

        # 4. Experience
        if data.get("experience"):
            self._add_section_header(pdf, "PROFESSIONAL EXPERIENCE")
            for exp in data["experience"]:
                # Title and Dates
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(100, 6, self._sanitize_text(exp.get("title", "")), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 6, self._sanitize_text(exp.get("period", "")), ln=True, align='R')
                
                # Company and Location
                pdf.set_font(self.font_main, style='I', size=11)
                pdf.cell(100, 5, self._sanitize_text(exp.get("company", "")), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 5, self._sanitize_text(exp.get("location", "")), ln=True, align='R')
                
                pdf.ln(2)
                
                # Bullet points
                pdf.set_font(self.font_main, size=10)
                for bullet in exp.get("bullets", []):
                    # Using a simple hyphen for 100% ATS safety and encoding compatibility
                    pdf.set_x(15)
                    pdf.cell(5, 5, "-", ln=False)
                    pdf.multi_cell(0, 5, self._sanitize_text(bullet))
                pdf.ln(3)

        # 5. Education
        if data.get("education"):
            self._add_section_header(pdf, "EDUCATION")
            for edu in data["education"]:
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(130, 6, self._sanitize_text(edu.get("degree", "")), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 6, self._sanitize_text(edu.get("period", "")), ln=True, align='R')
                
                pdf.set_font(self.font_main, size=11)
                pdf.cell(130, 5, self._sanitize_text(edu.get("school", "")), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 5, self._sanitize_text(edu.get("location", "")), ln=True, align='R')
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
        name = self._sanitize_text(data.get("name", "RESUME"))
        pdf.cell(0, 12, name.upper(), ln=True, align='C')
        
        pdf.set_font(self.font_main, size=10)
        contact = data.get("contact", {})
        contact_items = []
        if contact.get("email"): contact_items.append(contact["email"])
        if contact.get("phone"): contact_items.append(contact["phone"])
        if contact.get("location"): contact_items.append(contact["location"])
        
        pdf.cell(0, 6, self._sanitize_text("  |  ".join(contact_items)), ln=True, align='C')
        
        if contact.get("linkedin") or contact.get("portfolio"):
            links = []
            if contact.get("linkedin"): links.append(contact["linkedin"])
            if contact.get("portfolio"): links.append(contact["portfolio"])
            pdf.cell(0, 6, self._sanitize_text("  |  ".join(links)), ln=True, align='C')
            
        pdf.set_text_color(*text_color)
        pdf.set_y(45)

        # 2. Key Summary Area
        if data.get("summary"):
            self._add_premium_section_header(pdf, "EXECUTIVE SUMMARY", accent_color)
            pdf.set_font(self.font_main, size=11)
            pdf.multi_cell(0, 5, self._sanitize_text(data["summary"]))
            pdf.ln(4)

        # 3. Skills Matrix
        if data.get("skills"):
            self._add_premium_section_header(pdf, "CORE COMPETENCIES & TECHNICAL STACK", accent_color)
            pdf.set_font(self.font_main, size=11)
            # Using a pipe '|' instead of a Unicode bullet to ensure compatibility with core fonts like Helvetica
            skills_text = self._sanitize_text(" | ".join(data["skills"]))
            pdf.multi_cell(0, 5, skills_text)
            pdf.ln(4)

        # 4. Professional Experience
        if data.get("experience"):
            self._add_premium_section_header(pdf, "PROFESSIONAL EXPERIENCE", accent_color)
            for exp in data["experience"]:
                # Title
                pdf.set_font(self.font_main, style="B", size=12)
                pdf.set_text_color(*accent_color)
                pdf.cell(140, 7, self._sanitize_text(exp.get("title", "")), ln=False)
                # Period
                pdf.set_font(self.font_main, size=10)
                pdf.set_text_color(*text_color)
                pdf.cell(0, 7, self._sanitize_text(exp.get("period", "")), ln=True, align='R')
                
                # Company
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(140, 5, self._sanitize_text(exp.get("company", "")), ln=False)
                # Location
                pdf.set_font(self.font_main, style="I", size=10)
                pdf.cell(0, 5, self._sanitize_text(exp.get("location", "")), ln=True, align='R')
                
                pdf.ln(2)
                
                # Bullets
                pdf.set_font(self.font_main, size=10)
                pdf.set_text_color(60, 60, 60)
                for bullet in exp.get("bullets", []):
                    pdf.set_x(15)
                    pdf.set_font("zapfdingbats", size=8)
                    pdf.cell(5, 5, chr(108), ln=False) # Sleek bullet point
                    pdf.set_font(self.font_main, size=10)
                    pdf.multi_cell(0, 5, self._sanitize_text(bullet))
                pdf.ln(3)
 
        # 5. Education
        if data.get("education"):
            self._add_premium_section_header(pdf, "EDUCATION", accent_color)
            pdf.set_text_color(*text_color)
            for edu in data["education"]:
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(140, 6, self._sanitize_text(edu.get("degree", "")), ln=False)
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 6, self._sanitize_text(edu.get("period", "")), ln=True, align='R')
                
                pdf.set_font(self.font_main, size=10)
                pdf.cell(140, 5, self._sanitize_text(edu.get("school", "")), ln=False)
                pdf.set_font(self.font_main, style="I", size=10)
                pdf.cell(0, 5, self._sanitize_text(edu.get("location", "")), ln=True, align='R')
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
    def generate_creative_pdf(self, data: Dict[str, Any]) -> bytes:
        """
        Generates a modern, creative resume with a sidebar layout.
        Uses Emerald/Teal accents.
        """
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        # Colors (Modern Emerald)
        sidebar_bg = (242, 249, 247)
        accent_color = (16, 185, 129)
        text_color = (31, 41, 55)
        
        # 1. Sidebar Background
        pdf.set_fill_color(*sidebar_bg)
        pdf.rect(0, 0, 70, 297, 'F')
        
        # 2. Sidebar Content (Contact & Skills)
        pdf.set_y(20)
        pdf.set_x(10)
        
        # Contact
        pdf.set_font(self.font_main, style="B", size=12)
        pdf.set_text_color(*accent_color)
        pdf.cell(50, 8, "CONTACT", ln=True)
        pdf.set_text_color(*text_color)
        pdf.set_font(self.font_main, size=9)
        
        contact = data.get("contact", {})
        for key in ["email", "phone", "location", "linkedin", "portfolio"]:
            val = contact.get(key)
            if val:
                pdf.set_x(10)
                pdf.multi_cell(50, 5, self._sanitize_text(val))
                pdf.ln(2)
        
        pdf.ln(10)
        
        # Skills
        if data.get("skills"):
            pdf.set_x(10)
            pdf.set_font(self.font_main, style="B", size=12)
            pdf.set_text_color(*accent_color)
            pdf.cell(50, 8, "SKILLS", ln=True)
            pdf.set_text_color(*text_color)
            pdf.set_font(self.font_main, size=9)
            
            for skill in data["skills"]:
                pdf.set_x(10)
                # Small circle replacement for creative style
                pdf.set_font("zapfdingbats", size=6)
                pdf.cell(4, 5, chr(108), ln=False)
                pdf.set_font(self.font_main, size=9)
                pdf.multi_cell(46, 5, self._sanitize_text(skill))
                pdf.ln(1)
        
        # 3. Main Content (Name, Summary, Experience)
        pdf.set_left_margin(80)
        pdf.set_y(20)
        
        # Name
        pdf.set_font(self.font_main, style="B", size=24)
        name = self._sanitize_text(data.get("name", "RESUME"))
        pdf.set_text_color(*accent_color)
        pdf.multi_cell(120, 10, name.upper())
        pdf.ln(5)
        
        pdf.set_text_color(*text_color)
        
        # Summary
        if data.get("summary"):
            pdf.set_font(self.font_main, style="B", size=13)
            pdf.cell(0, 8, "PROFILE", ln=True)
            pdf.set_font(self.font_main, size=10)
            pdf.multi_cell(0, 5, self._sanitize_text(data["summary"]))
            pdf.ln(6)
            
        # Experience
        if data.get("experience"):
            pdf.set_font(self.font_main, style="B", size=13)
            pdf.cell(0, 8, "EXPERIENCE", ln=True)
            for exp in data["experience"]:
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(0, 6, self._sanitize_text(exp.get("title", "")), ln=True)
                pdf.set_font(self.font_main, style="I", size=10)
                pdf.cell(0, 5, self._sanitize_text(f"{exp.get('company', '')} | {exp.get('period', '')}"), ln=True)
                
                pdf.set_font(self.font_main, size=9)
                pdf.set_text_color(75, 85, 99)
                for bullet in exp.get("bullets", []):
                    pdf.set_x(85)
                    pdf.cell(3, 5, "-", ln=False)
                    pdf.multi_cell(0, 5, self._sanitize_text(bullet))
                pdf.set_text_color(*text_color)
                pdf.ln(4)
                
        # Education
        if data.get("education"):
            pdf.set_font(self.font_main, style="B", size=13)
            pdf.cell(0, 8, "EDUCATION", ln=True)
            for edu in data["education"]:
                pdf.set_font(self.font_main, style="B", size=10)
                pdf.cell(0, 5, self._sanitize_text(edu.get("degree", "")), ln=True)
                pdf.set_font(self.font_main, size=9)
                pdf.cell(0, 5, self._sanitize_text(f"{edu.get('school', '')} | {edu.get('period', '')}"), ln=True)
                pdf.ln(3)

        return pdf.output()

    def generate_minimalist_pdf(self, data: Dict[str, Any]) -> bytes:
        """
        Generates a sleek, high-whitespace minimalist resume.
        Centered headers and clean lines.
        """
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=20)
        pdf.add_page()
        
        # Colors (Sophisticated Slate)
        primary_color = (15, 23, 42)
        secondary_color = (100, 116, 139)
        
        # 1. Centered Header
        pdf.set_y(25)
        pdf.set_font(self.font_main, style="B", size=26)
        pdf.set_text_color(*primary_color)
        name = self._sanitize_text(data.get("name", "RESUME"))
        pdf.cell(0, 12, name.upper(), ln=True, align='C')
        
        pdf.set_font(self.font_main, size=10)
        pdf.set_text_color(*secondary_color)
        contact = data.get("contact", {})
        contact_items = [v for v in contact.values() if v]
        pdf.cell(0, 8, self._sanitize_text("   .   ".join(contact_items)), ln=True, align='C')
        
        pdf.ln(15)
        
        # 2. Content Sections
        sections = [
            ("SUMMARY", data.get("summary")),
            ("SKILLS", ", ".join(data.get("skills", [])) if data.get("skills") else None),
            ("EXPERIENCE", data.get("experience")),
            ("EDUCATION", data.get("education"))
        ]
        
        for title, content in sections:
            if not content: continue
            
            # Section Label
            pdf.set_font(self.font_main, style="B", size=10)
            pdf.set_text_color(*secondary_color)
            pdf.cell(0, 10, title, ln=True, align='C')
            
            # Simple line
            pdf.set_draw_color(*secondary_color)
            pdf.set_line_width(0.2)
            pdf.line(80, pdf.get_y(), 130, pdf.get_y())
            pdf.ln(4)
            
            pdf.set_text_color(*primary_color)
            
            if title == "EXPERIENCE":
                for exp in content:
                    pdf.set_font(self.font_main, style="B", size=11)
                    pdf.cell(0, 6, self._sanitize_text(exp.get("title", "")).upper(), ln=True, align='C')
                    pdf.set_font(self.font_main, size=10)
                    pdf.cell(0, 5, self._sanitize_text(f"{exp.get('company', '')}  |  {exp.get('period', '')}"), ln=True, align='C')
                    
                    pdf.ln(2)
                    pdf.set_font(self.font_main, size=10)
                    for bullet in exp.get("bullets", []):
                        pdf.set_x(20)
                        pdf.multi_cell(170, 5, self._sanitize_text(bullet), align='C')
                    pdf.ln(6)
            elif title == "EDUCATION":
                for edu in content:
                    pdf.set_font(self.font_main, style="B", size=10)
                    pdf.cell(0, 5, self._sanitize_text(edu.get("degree", "")).upper(), ln=True, align='C')
                    pdf.set_font(self.font_main, size=9)
                    pdf.cell(0, 5, self._sanitize_text(f"{edu.get('school', '')}  |  {edu.get('period', '')}"), ln=True, align='C')
                    pdf.ln(4)
            else:
                pdf.set_font(self.font_main, size=10)
                pdf.set_x(20)
                pdf.multi_cell(170, 6, self._sanitize_text(content), align='C')
                pdf.ln(8)

        return pdf.output()

    def generate_startup_pdf(self, data: Dict[str, Any]) -> bytes:
        """
        Generates a tech-focused, high contrast 'Startup' resume.
        Features dark headers and Courier font elements.
        """
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        # Colors
        header_bg = (18, 18, 18)
        accent_color = (0, 212, 255) # Cyber Cyan
        text_color = (40, 40, 40)
        
        # 1. Tech Header
        pdf.set_fill_color(*header_bg)
        pdf.rect(0, 0, 210, 45, 'F')
        
        pdf.set_text_color(*accent_color)
        pdf.set_y(12)
        pdf.set_font("courier", style="B", size=24)
        name = self._sanitize_text(data.get("name", "RESUME"))
        pdf.cell(0, 10, f"> {name.upper()}_", ln=True)
        
        pdf.set_font(self.font_main, size=10)
        pdf.set_text_color(200, 200, 200)
        
        contact = data.get("contact", {})
        contact_items = [v for v in contact.values() if v]
        pdf.cell(0, 6, self._sanitize_text(" // ".join(contact_items)), ln=True)
        pdf.ln(15)
        
        pdf.set_text_color(*text_color)
        
        # 2. Tech Skills (Prominent in Startup CVs)
        if data.get("skills"):
            pdf.set_font("courier", style="B", size=12)
            pdf.set_text_color(*accent_color)
            pdf.cell(0, 8, "/* TECH_STACK */", ln=True)
            
            pdf.set_font(self.font_main, size=10)
            pdf.set_text_color(*text_color)
            pdf.multi_cell(0, 5, self._sanitize_text(" | ".join(data["skills"])))
            pdf.ln(4)
            
        # 3. Summary
        if data.get("summary"):
            pdf.set_font("courier", style="B", size=12)
            pdf.set_text_color(*accent_color)
            pdf.cell(0, 8, "/* EXEC_SUMMARY */", ln=True)
            
            pdf.set_font(self.font_main, size=10)
            pdf.set_text_color(*text_color)
            pdf.multi_cell(0, 5, self._sanitize_text(data["summary"]))
            pdf.ln(4)
            
        # 4. Experience
        if data.get("experience"):
            pdf.set_font("courier", style="B", size=12)
            pdf.set_text_color(*accent_color)
            pdf.cell(0, 8, "/* EXPERIENCE_LOG */", ln=True)
            
            pdf.set_text_color(*text_color)
            for exp in data["experience"]:
                pdf.set_font(self.font_main, style="B", size=11)
                pdf.cell(140, 6, self._sanitize_text(exp.get("title", "")), ln=False)
                pdf.set_font("courier", size=9)
                pdf.cell(0, 6, self._sanitize_text(exp.get("period", "")), ln=True, align='R')
                
                pdf.set_font(self.font_main, style="B", size=10)
                pdf.set_text_color(100, 100, 100)
                pdf.cell(140, 5, self._sanitize_text(exp.get("company", "")), ln=False)
                pdf.cell(0, 5, self._sanitize_text(exp.get("location", "")), ln=True, align='R')
                
                pdf.ln(2)
                pdf.set_font(self.font_main, size=10)
                pdf.set_text_color(*text_color)
                for bullet in exp.get("bullets", []):
                    pdf.set_x(15)
                    pdf.cell(4, 5, ">", ln=False)
                    pdf.multi_cell(0, 5, self._sanitize_text(bullet))
                pdf.ln(3)

        # 5. Education
        if data.get("education"):
            pdf.set_font("courier", style="B", size=12)
            pdf.set_text_color(*accent_color)
            pdf.cell(0, 8, "/* EDUCATION */", ln=True)
            
            pdf.set_text_color(*text_color)
            for edu in data["education"]:
                pdf.set_font(self.font_main, style="B", size=10)
                pdf.cell(140, 5, self._sanitize_text(edu.get("degree", "")), ln=False)
                pdf.set_font("courier", size=9)
                pdf.cell(0, 5, self._sanitize_text(edu.get("period", "")), ln=True, align='R')
                
                pdf.set_font(self.font_main, size=10)
                pdf.cell(0, 5, self._sanitize_text(edu.get("school", "")), ln=True)
                pdf.ln(2)
                
        return pdf.output()

    def generate_academic_pdf(self, data: Dict[str, Any]) -> bytes:
        """
        Generates a highly formal, academic CV format using Times font.
        Focuses on density and traditional structure.
        """
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        font_acad = "times"
        
        # 1. Centered Header
        pdf.set_font(font_acad, style="B", size=18)
        name = self._sanitize_text(data.get("name", "Curriculum Vitae"))
        pdf.cell(0, 8, name.upper(), ln=True, align='C')
        
        pdf.set_font(font_acad, size=11)
        contact = data.get("contact", {})
        contact_arr = [v for v in contact.values() if v]
        pdf.cell(0, 6, self._sanitize_text(" | ".join(contact_arr)), ln=True, align='C')
        
        pdf.set_line_width(0.3)
        pdf.line(15, pdf.get_y()+2, 195, pdf.get_y()+2)
        pdf.ln(6)
        
        # 2. Summary
        if data.get("summary"):
            pdf.set_font(font_acad, style="B", size=12)
            pdf.cell(0, 6, "PROFILE", ln=True)
            pdf.set_font(font_acad, size=11)
            pdf.multi_cell(0, 5, self._sanitize_text(data["summary"]))
            pdf.ln(4)
            
        # 3. Education (Usually first in Academic CVs)
        if data.get("education"):
            pdf.set_font(font_acad, style="B", size=12)
            pdf.cell(0, 6, "EDUCATION", ln=True)
            for edu in data["education"]:
                pdf.set_font(font_acad, style="B", size=11)
                pdf.cell(140, 5, self._sanitize_text(edu.get("school", "")), ln=False)
                pdf.set_font(font_acad, size=11)
                pdf.cell(0, 5, self._sanitize_text(edu.get("period", "")), ln=True, align='R')
                
                pdf.set_font(font_acad, style="I", size=11)
                pdf.cell(0, 5, self._sanitize_text(edu.get("degree", "")), ln=True)
                pdf.ln(2)
                
        # 4. Experience & Research
        if data.get("experience"):
            pdf.set_font(font_acad, style="B", size=12)
            pdf.cell(0, 6, "EXPERIENCE & RESEARCH", ln=True)
            for exp in data["experience"]:
                pdf.set_font(font_acad, style="B", size=11)
                pdf.cell(140, 5, self._sanitize_text(exp.get("title", "")), ln=False)
                pdf.set_font(font_acad, size=11)
                pdf.cell(0, 5, self._sanitize_text(exp.get("period", "")), ln=True, align='R')
                
                pdf.set_font(font_acad, style="I", size=11)
                pdf.cell(0, 5, self._sanitize_text(exp.get("company", "")), ln=True)
                
                pdf.set_font(font_acad, size=11)
                for bullet in exp.get("bullets", []):
                    pdf.set_x(20)
                    pdf.cell(3, 5, "-", ln=False)
                    pdf.multi_cell(0, 5, self._sanitize_text(bullet))
                pdf.ln(3)
                
        # 5. Skills
        if data.get("skills"):
            pdf.set_font(font_acad, style="B", size=12)
            pdf.cell(0, 6, "TECHNICAL CAPABILITIES", ln=True)
            pdf.set_font(font_acad, size=11)
            pdf.multi_cell(0, 5, self._sanitize_text(", ".join(data["skills"])))
            
        return pdf.output()


resume_generator = ResumeGenerator()
