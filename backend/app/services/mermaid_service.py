"""
Mermaid Service - Renders Mermaid.js diagrams to PNG images

Uses the mermaid.ink public API for server-side rendering.
"""
import base64
import hashlib
import io
import logging
import requests
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# mermaid.ink API base URL
MERMAID_INK_URL = "https://mermaid.ink/img/"

# Cache for rendered diagrams (in-memory, process-scoped)
_diagram_cache: dict = {}


def get_diagram_cache_key(mermaid_code: str) -> str:
    """Generate a cache key based on the mermaid code hash."""
    return hashlib.md5(mermaid_code.encode('utf-8')).hexdigest()


def render_mermaid_to_png(mermaid_code: str, use_cache: bool = True) -> Optional[bytes]:
    """
    Render a Mermaid.js diagram to PNG image bytes.
    
    Uses the mermaid.ink public API for rendering.
    
    Args:
        mermaid_code: The Mermaid diagram code
        use_cache: Whether to use caching (default True)
        
    Returns:
        PNG image bytes, or None if rendering failed
    """
    if not mermaid_code or not mermaid_code.strip():
        logger.warning("Empty mermaid code provided")
        return None
    
    # Clean up the mermaid code
    mermaid_code = mermaid_code.strip()
    
    # Check cache first
    cache_key = get_diagram_cache_key(mermaid_code)
    if use_cache and cache_key in _diagram_cache:
        logger.debug(f"Using cached diagram for key {cache_key[:8]}...")
        return _diagram_cache[cache_key]
    
    try:
        # Encode the mermaid code as base64 for the mermaid.ink API
        encoded_diagram = base64.urlsafe_b64encode(
            mermaid_code.encode('utf-8')
        ).decode('utf-8')
        
        # Build the URL
        url = f"{MERMAID_INK_URL}{encoded_diagram}"
        
        logger.info(f"Rendering mermaid diagram via mermaid.ink...")
        
        # Make the request with a reasonable timeout
        response = requests.get(
            url,
            timeout=30,
            headers={
                'Accept': 'image/png',
                'User-Agent': 'RFP-Proposal-Generator/1.0'
            }
        )
        
        if response.status_code == 200:
            image_data = response.content
            
            # Verify it's valid image data (PNG or JPEG)
            is_png = image_data[:8] == b'\x89PNG\r\n\x1a\n'
            is_jpeg = image_data[:2] == b'\xff\xd8'
            
            if is_png or is_jpeg:
                image_type = "PNG" if is_png else "JPEG"
                logger.info(f"Successfully rendered {image_type} diagram ({len(image_data)} bytes)")
                
                # Cache the result
                if use_cache:
                    _diagram_cache[cache_key] = image_data
                
                return image_data
            else:
                logger.error("Response was not valid image data (PNG or JPEG)")
                return None
        else:
            logger.error(f"mermaid.ink returned status {response.status_code}")
            return None
            
    except requests.Timeout:
        logger.error("Timeout while rendering mermaid diagram")
        return None
    except requests.RequestException as e:
        logger.error(f"Request error while rendering mermaid diagram: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error rendering mermaid diagram: {e}")
        return None


def render_mermaid_to_file(mermaid_code: str, output_path: str) -> bool:
    """
    Render a Mermaid.js diagram and save to a file.
    
    Args:
        mermaid_code: The Mermaid diagram code
        output_path: Path to save the PNG file
        
    Returns:
        True if successful, False otherwise
    """
    png_data = render_mermaid_to_png(mermaid_code)
    
    if png_data:
        try:
            with open(output_path, 'wb') as f:
                f.write(png_data)
            logger.info(f"Saved diagram to {output_path}")
            return True
        except IOError as e:
            logger.error(f"Failed to save diagram: {e}")
            return False
    
    return False


def render_mermaid_to_bytes_io(mermaid_code: str) -> Optional[io.BytesIO]:
    """
    Render a Mermaid.js diagram to a BytesIO buffer.
    
    Useful for directly inserting into documents without writing to disk.
    
    Args:
        mermaid_code: The Mermaid diagram code
        
    Returns:
        BytesIO buffer containing PNG data, or None if rendering failed
    """
    png_data = render_mermaid_to_png(mermaid_code)
    
    if png_data:
        buffer = io.BytesIO(png_data)
        buffer.seek(0)
        return buffer
    
    return None


def clear_cache():
    """Clear the diagram cache."""
    global _diagram_cache
    _diagram_cache.clear()
    logger.info("Cleared mermaid diagram cache")
