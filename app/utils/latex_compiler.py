"""
LaTeX Compilation Utility
=========================
Compiles raw LaTeX strings into PDF bytes using pdflatex.
Handles temporary file management and subprocess execution.
"""

import os
import subprocess
import tempfile
import shutil
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class LaTeXCompilationError(Exception):
    """Custom exception for LaTeX compilation failures."""
    def __init__(self, message: str, log: Optional[str] = None):
        super().__init__(message)
        self.log = log

def compile_latex_to_pdf(latex_code: str, timeout: int = 30) -> bytes:
    """
    Compiles LaTeX code to a PDF and returns the bytes.
    
    Args:
        latex_code: The raw LaTeX string.
        timeout: Maximum seconds to allow pdflatex to run.
        
    Returns:
        bytes: The generated PDF content.
        
    Raises:
        LaTeXCompilationError: If compilation fails or pdflatex is missing.
    """
    if not latex_code:
        raise LaTeXCompilationError("No LaTeX code provided.")

    # Create a temporary directory for the compilation workspace
    temp_dir = tempfile.mkdtemp(prefix="latex_build_")
    try:
        tex_file_path = os.path.join(temp_dir, "resume.tex")
        pdf_file_path = os.path.join(temp_dir, "resume.pdf")
        
        # Write the LaTeX code to a file
        with open(tex_file_path, "w", encoding="utf-8") as f:
            f.write(latex_code)
            
        # Run pdflatex
        # -interaction=nonstopmode prevents hanging on errors
        # -output-directory ensures files go to our temp dir
        try:
            process = subprocess.run(
                [
                    "pdflatex", 
                    "-interaction=nonstopmode", 
                    "-output-directory", temp_dir,
                    tex_file_path
                ],
                capture_output=True,
                text=True,
                timeout=timeout
            )
        except FileNotFoundError:
            raise LaTeXCompilationError(
                "pdflatex command not found. Ensure LaTeX (MikTeX/TeXLive) is installed on the server."
            )
        except subprocess.TimeoutExpired:
            raise LaTeXCompilationError(f"LaTeX compilation timed out after {timeout} seconds.")

        # Check for errors
        if process.returncode != 0:
            error_log = process.stdout
            logger.error(f"[LaTeX] Compilation failed for {tex_file_path}:\n{error_log}")
            raise LaTeXCompilationError("LaTeX compilation failed.", log=error_log)

        # Check if PDF exists
        if not os.path.exists(pdf_file_path):
            raise LaTeXCompilationError("pdflatex finished but resume.pdf was not found.")

        # Read the PDF bytes
        with open(pdf_file_path, "rb") as f:
            pdf_bytes = f.read()
            
        return pdf_bytes

    finally:
        # Clean up temporary directory
        shutil.rmtree(temp_dir, ignore_errors=True)
