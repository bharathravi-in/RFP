"""
Input validation and sanitization utilities.

Provides:
- File type validation with magic bytes
- Input sanitization for user content
- Markdown sanitization to prevent XSS
"""
import re
import logging
from typing import BinaryIO, Optional, List, Dict, Any
from werkzeug.datastructures import FileStorage

logger = logging.getLogger(__name__)


# File magic bytes for common document types
FILE_SIGNATURES = {
    'pdf': [b'%PDF'],
    'docx': [b'PK\x03\x04'],  # Office Open XML
    'xlsx': [b'PK\x03\x04'],  # Office Open XML
    'pptx': [b'PK\x03\x04'],  # Office Open XML
    'doc': [b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1'],  # OLE compound doc
    'xls': [b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1'],
    'ppt': [b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1'],
    'png': [b'\x89PNG\r\n\x1a\n'],
    'jpg': [b'\xff\xd8\xff'],
    'jpeg': [b'\xff\xd8\xff'],
    'gif': [b'GIF87a', b'GIF89a'],
    'zip': [b'PK\x03\x04'],
    'txt': None,  # No magic bytes for text
    'csv': None,
    'json': None,
    'md': None,
}

# Maximum file size limits by type (in bytes)
FILE_SIZE_LIMITS = {
    'pdf': 50 * 1024 * 1024,      # 50MB
    'docx': 25 * 1024 * 1024,     # 25MB
    'xlsx': 25 * 1024 * 1024,     # 25MB
    'pptx': 100 * 1024 * 1024,    # 100MB
    'image': 10 * 1024 * 1024,    # 10MB
    'default': 25 * 1024 * 1024,  # 25MB
}


def validate_file_type(file: FileStorage, allowed_types: List[str]) -> tuple[bool, str]:
    """
    Validate file type using magic bytes, not just extension.
    
    Args:
        file: The uploaded file
        allowed_types: List of allowed extensions (e.g., ['pdf', 'docx'])
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Get extension from filename
    if '.' not in file.filename:
        return False, "File must have an extension"
    
    ext = file.filename.rsplit('.', 1)[1].lower()
    
    if ext not in allowed_types:
        return False, f"File type '{ext}' not allowed. Allowed: {', '.join(allowed_types)}"
    
    # Read first 16 bytes for magic byte check
    file.seek(0)
    header = file.read(16)
    file.seek(0)
    
    if not header:
        return False, "Empty file"
    
    # Check magic bytes if defined for this type
    expected_signatures = FILE_SIGNATURES.get(ext)
    
    if expected_signatures is not None:
        matched = any(header.startswith(sig) for sig in expected_signatures)
        if not matched:
            logger.warning(f"File magic bytes mismatch for {file.filename}, expected {ext}")
            return False, f"File content does not match {ext} format"
    
    return True, ""


def validate_file_size(file: FileStorage, max_size: Optional[int] = None) -> tuple[bool, str]:
    """
    Validate file size against limits.
    
    Args:
        file: The uploaded file
        max_size: Maximum size in bytes (uses default if not specified)
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    file.seek(0, 2)  # Seek to end
    size = file.tell()
    file.seek(0)
    
    if max_size is None:
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        max_size = FILE_SIZE_LIMITS.get(ext, FILE_SIZE_LIMITS['default'])
    
    if size > max_size:
        max_mb = max_size / (1024 * 1024)
        return False, f"File too large. Maximum size: {max_mb:.1f}MB"
    
    return True, ""


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal and other attacks.
    
    Args:
        filename: Original filename
    
    Returns:
        Sanitized filename
    """
    import unicodedata
    
    # Normalize unicode
    filename = unicodedata.normalize('NFKD', filename)
    
    # Remove directory components
    filename = filename.replace('\\', '/').split('/')[-1]
    
    # Remove or replace dangerous characters
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', filename)
    
    # Prevent hidden files
    if filename.startswith('.'):
        filename = '_' + filename[1:]
    
    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:250] + ('.' + ext if ext else '')
    
    return filename or 'unnamed_file'


def sanitize_html(html: str, allowed_tags: Optional[List[str]] = None) -> str:
    """
    Sanitize HTML content to prevent XSS attacks.
    
    Uses bleach library for robust sanitization.
    Falls back to regex-based stripping if bleach not available.
    
    Args:
        html: HTML content to sanitize
        allowed_tags: List of allowed HTML tags
    
    Returns:
        Sanitized HTML
    """
    if allowed_tags is None:
        allowed_tags = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre']
    
    try:
        import bleach
        return bleach.clean(
            html,
            tags=allowed_tags,
            attributes={'a': ['href', 'title']},
            strip=True
        )
    except ImportError:
        # Fallback: strip all HTML tags
        return re.sub(r'<[^>]+>', '', html)


def sanitize_markdown(markdown: str) -> str:
    """
    Sanitize markdown content.
    
    - Removes potential script injections
    - Sanitizes URLs in links/images
    - Prevents HTML injection
    
    Args:
        markdown: Markdown content
    
    Returns:
        Sanitized markdown
    """
    # Remove inline HTML scripts
    markdown = re.sub(r'<script[^>]*>.*?</script>', '', markdown, flags=re.IGNORECASE | re.DOTALL)
    markdown = re.sub(r'<style[^>]*>.*?</style>', '', markdown, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove event handlers
    markdown = re.sub(r'\bon\w+\s*=', '', markdown, flags=re.IGNORECASE)
    
    # Sanitize JavaScript URLs in markdown links
    markdown = re.sub(r'\[([^\]]*)\]\(javascript:[^)]*\)', r'[\1](#)', markdown, flags=re.IGNORECASE)
    markdown = re.sub(r'\[([^\]]*)\]\(data:[^)]*\)', r'[\1](#)', markdown, flags=re.IGNORECASE)
    
    return markdown


def validate_email(email: str) -> tuple[bool, str]:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if re.match(pattern, email):
        return True, ""
    return False, "Invalid email format"


def validate_string_length(value: str, min_len: int = 0, max_len: int = 10000, field_name: str = "Field") -> tuple[bool, str]:
    """Validate string length."""
    if len(value) < min_len:
        return False, f"{field_name} must be at least {min_len} characters"
    if len(value) > max_len:
        return False, f"{field_name} must not exceed {max_len} characters"
    return True, ""


def sanitize_user_input(data: Dict[str, Any], sanitize_html_fields: List[str] = None) -> Dict[str, Any]:
    """
    Sanitize user input dictionary.
    
    - Trims whitespace from strings
    - Sanitizes HTML in specified fields
    - Removes null bytes
    
    Args:
        data: Input dictionary
        sanitize_html_fields: Fields that should have HTML sanitized
    
    Returns:
        Sanitized dictionary
    """
    sanitize_html_fields = sanitize_html_fields or []
    result = {}
    
    for key, value in data.items():
        if isinstance(value, str):
            # Remove null bytes
            value = value.replace('\x00', '')
            # Trim whitespace
            value = value.strip()
            # Sanitize HTML if specified
            if key in sanitize_html_fields:
                value = sanitize_html(value)
            result[key] = value
        elif isinstance(value, dict):
            result[key] = sanitize_user_input(value, sanitize_html_fields)
        elif isinstance(value, list):
            result[key] = [
                sanitize_user_input(item, sanitize_html_fields) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value
    
    return result
