"""
Document text extraction service.
"""
import os
import logging

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: str, file_type: str = None) -> str:
    """
    Extract text content from uploaded files.
    
    Args:
        file_path: Path to the file
        file_type: MIME type of the file
        
    Returns:
        Extracted text content
    """
    if not file_path or not os.path.exists(file_path):
        return ""
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        # Text files
        if file_ext in ['.txt', '.md', '.csv']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        
        # PDF files
        if file_ext == '.pdf':
            return extract_pdf(file_path)
        
        # Word documents
        if file_ext in ['.docx', '.doc']:
            return extract_docx(file_path)
        
        # Excel files
        if file_ext in ['.xlsx', '.xls']:
            return extract_excel(file_path)
        
        # Default: try to read as text
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except:
            return ""
            
    except Exception as e:
        logger.error(f"Failed to extract text from {file_path}: {e}")
        return f"[Content extraction failed: {str(e)}]"


def extract_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF or pdfplumber."""
    try:
        # Try PyMuPDF first (fitz)
        import fitz
        doc = fitz.open(file_path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n\n".join(text_parts)
    except ImportError:
        pass
    
    try:
        # Fallback to pdfplumber
        import pdfplumber
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        return "\n\n".join(text_parts)
    except ImportError:
        pass
    
    try:
        # Fallback to PyPDF2
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return "\n\n".join(text_parts)
    except ImportError:
        return "[PDF extraction requires PyMuPDF, pdfplumber, or PyPDF2]"


def extract_docx(file_path: str) -> str:
    """Extract text from Word documents."""
    try:
        from docx import Document
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except ImportError:
        return "[DOCX extraction requires python-docx]"
    except Exception as e:
        return f"[DOCX extraction failed: {str(e)}]"


def extract_excel(file_path: str) -> str:
    """Extract text from Excel files."""
    try:
        import pandas as pd
        excel_file = pd.ExcelFile(file_path)
        text_parts = []
        
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            text_parts.append(f"## {sheet_name}\n")
            text_parts.append(df.to_string())
        
        return "\n\n".join(text_parts)
    except ImportError:
        return "[Excel extraction requires pandas and openpyxl]"
    except Exception as e:
        return f"[Excel extraction failed: {str(e)}]"
