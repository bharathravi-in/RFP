"""
Middleware package for RFP application.

Provides:
- Rate limiting
- Request logging with correlation IDs
- Global error handling
"""
from .rate_limiter import rate_limit, get_rate_limiter, add_rate_limit_headers
from .error_handler import (
    init_error_handlers,
    APIError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    RateLimitError,
)
from .request_logger import init_request_logging, get_request_id, log_with_context

__all__ = [
    # Rate limiting
    'rate_limit',
    'get_rate_limiter',
    'add_rate_limit_headers',
    
    # Error handling
    'init_error_handlers',
    'APIError',
    'ValidationError',
    'NotFoundError',
    'UnauthorizedError',
    'ForbiddenError',
    'RateLimitError',
    
    # Request logging
    'init_request_logging',
    'get_request_id',
    'log_with_context',
]


def init_middleware(app):
    """Initialize all middleware with the Flask app."""
    init_error_handlers(app)
    init_request_logging(app)
    app.after_request(add_rate_limit_headers)
    return app
