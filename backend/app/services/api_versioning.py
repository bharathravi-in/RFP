"""
API Versioning Middleware.

Provides support for API versioning with /api/v1/ prefix.
Legacy /api/ routes continue to work for backward compatibility.
"""
from flask import Blueprint, request, g


class APIVersioning:
    """
    API versioning support.
    
    Current version: v1
    Supported headers: X-API-Version
    URL patterns: /api/v1/..., /api/...
    """
    
    CURRENT_VERSION = 'v1'
    SUPPORTED_VERSIONS = ['v1']
    
    def __init__(self, app=None):
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize API versioning for the Flask app."""
        
        @app.before_request
        def set_api_version():
            """Determine API version from URL or header."""
            g.api_version = self.CURRENT_VERSION
            
            # Check URL path for version
            if request.path.startswith('/api/v1/'):
                g.api_version = 'v1'
            
            # Header override
            version_header = request.headers.get('X-API-Version')
            if version_header and version_header in self.SUPPORTED_VERSIONS:
                g.api_version = version_header
        
        @app.after_request
        def add_version_header(response):
            """Add API version to response headers."""
            if hasattr(g, 'api_version'):
                response.headers['X-API-Version'] = g.api_version
            return response


def get_api_version() -> str:
    """Get current API version from request context."""
    return getattr(g, 'api_version', 'v1')


# Blueprint for versioned routes (future use)
v1_bp = Blueprint('api_v1', __name__, url_prefix='/api/v1')


@v1_bp.route('/version')
def version_info():
    """Return API version information."""
    return {
        'version': APIVersioning.CURRENT_VERSION,
        'supported_versions': APIVersioning.SUPPORTED_VERSIONS,
        'deprecation_notice': None
    }
