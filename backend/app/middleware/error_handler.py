"""
Global error handler for standardized error responses.

Provides consistent error format across all endpoints.
"""
from flask import jsonify, request, g
import logging
import traceback

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base exception for API errors with structured response."""
    
    def __init__(self, message, code='INTERNAL_ERROR', status_code=500, details=None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class ValidationError(APIError):
    """Raised when request validation fails."""
    
    def __init__(self, message, details=None):
        super().__init__(message, 'VALIDATION_ERROR', 400, details)


class NotFoundError(APIError):
    """Raised when a resource is not found."""
    
    def __init__(self, resource_type, resource_id=None):
        message = f"{resource_type} not found"
        if resource_id:
            message = f"{resource_type} with ID {resource_id} not found"
        super().__init__(message, 'NOT_FOUND', 404)


class UnauthorizedError(APIError):
    """Raised for authentication failures."""
    
    def __init__(self, message="Authentication required"):
        super().__init__(message, 'UNAUTHORIZED', 401)


class ForbiddenError(APIError):
    """Raised for authorization failures."""
    
    def __init__(self, message="Access denied"):
        super().__init__(message, 'FORBIDDEN', 403)


class RateLimitError(APIError):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, retry_after=60):
        super().__init__(
            "Rate limit exceeded",
            'RATE_LIMITED',
            429,
            {'retry_after': retry_after}
        )


def create_error_response(error):
    """Create standardized error response."""
    request_id = getattr(g, 'request_id', 'unknown')
    
    response_body = {
        'error': {
            'code': getattr(error, 'code', 'INTERNAL_ERROR'),
            'message': str(error.message) if hasattr(error, 'message') else str(error),
            'request_id': request_id
        }
    }
    
    # Add details if available
    if hasattr(error, 'details') and error.details:
        response_body['error']['details'] = error.details
    
    return response_body


def init_error_handlers(app):
    """Register global error handlers with Flask app."""
    
    @app.errorhandler(APIError)
    def handle_api_error(error):
        """Handle custom API errors."""
        logger.warning(f"API Error: {error.code} - {error.message}")
        response = jsonify(create_error_response(error))
        response.status_code = error.status_code
        return response
    
    @app.errorhandler(400)
    def handle_bad_request(error):
        """Handle 400 Bad Request."""
        return jsonify(create_error_response(
            ValidationError("Invalid request")
        )), 400
    
    @app.errorhandler(401)
    def handle_unauthorized(error):
        """Handle 401 Unauthorized."""
        return jsonify(create_error_response(
            UnauthorizedError()
        )), 401
    
    @app.errorhandler(403)
    def handle_forbidden(error):
        """Handle 403 Forbidden."""
        return jsonify(create_error_response(
            ForbiddenError()
        )), 403
    
    @app.errorhandler(404)
    def handle_not_found(error):
        """Handle 404 Not Found."""
        return jsonify(create_error_response(
            NotFoundError("Resource")
        )), 404
    
    @app.errorhandler(429)
    def handle_rate_limit(error):
        """Handle 429 Rate Limit."""
        retry_after = getattr(error, 'retry_after', 60)
        response = jsonify(create_error_response(
            RateLimitError(retry_after)
        ))
        response.status_code = 429
        response.headers['Retry-After'] = str(retry_after)
        return response
    
    @app.errorhandler(500)
    def handle_server_error(error):
        """Handle 500 Internal Server Error."""
        logger.error(f"Internal error: {error}\n{traceback.format_exc()}")
        return jsonify(create_error_response(
            APIError("An internal error occurred", 'INTERNAL_ERROR', 500)
        )), 500
    
    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        """Handle any unexpected exceptions."""
        logger.error(f"Unexpected error: {error}\n{traceback.format_exc()}")
        
        # In development, include stack trace
        if app.debug:
            details = {'traceback': traceback.format_exc()}
        else:
            details = None
        
        return jsonify(create_error_response(
            APIError("An unexpected error occurred", 'UNEXPECTED_ERROR', 500, details)
        )), 500
