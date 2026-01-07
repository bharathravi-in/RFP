"""
Request logging middleware with correlation IDs.

Provides structured JSON logging with request tracking for observability.
"""
import uuid
import time
import logging
import json
from functools import wraps
from flask import request, g, has_request_context
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request


class StructuredLogFormatter(logging.Formatter):
    """
    JSON log formatter for structured logging.
    
    Outputs logs in JSON format suitable for log aggregation tools
    like Elasticsearch, Loki, or CloudWatch.
    """
    
    def format(self, record):
        log_data = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        # Add request context if available
        if has_request_context():
            log_data['request_id'] = getattr(g, 'request_id', None)
            log_data['path'] = request.path
            log_data['method'] = request.method
            
            # Add user context if authenticated
            try:
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
                if user_id:
                    log_data['user_id'] = user_id
            except:
                pass
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, 'extra'):
            log_data.update(record.extra)
        
        return json.dumps(log_data)


class RequestLogger:
    """
    Request logging middleware.
    
    Provides:
    - Unique request ID for each request
    - Request/response logging
    - Duration tracking
    """
    
    def __init__(self, app=None):
        self.app = app
        self.enabled = True
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize with Flask app."""
        import os
        
        self.enabled = os.environ.get('ENABLE_REQUEST_LOGGING', 'true').lower() == 'true'
        log_format = os.environ.get('LOG_FORMAT', 'text')
        
        # Configure root logger
        log_level = os.environ.get('LOG_LEVEL', 'INFO')
        logging.getLogger().setLevel(getattr(logging, log_level, logging.INFO))
        
        # Apply structured formatter if JSON format requested
        if log_format == 'json':
            handler = logging.StreamHandler()
            handler.setFormatter(StructuredLogFormatter())
            
            # Replace existing handlers
            root_logger = logging.getLogger()
            for h in root_logger.handlers[:]:
                root_logger.removeHandler(h)
            root_logger.addHandler(handler)
        
        # Register before/after request handlers
        @app.before_request
        def before_request():
            g.request_id = str(uuid.uuid4())[:8]
            g.request_start_time = time.time()
        
        @app.after_request
        def after_request(response):
            if self.enabled and not request.path.startswith('/static'):
                duration_ms = (time.time() - g.get('request_start_time', time.time())) * 1000
                
                log_data = {
                    'type': 'request',
                    'request_id': g.get('request_id'),
                    'method': request.method,
                    'path': request.path,
                    'status': response.status_code,
                    'duration_ms': round(duration_ms, 2),
                    'remote_addr': request.remote_addr,
                }
                
                # Get user ID if available
                try:
                    verify_jwt_in_request(optional=True)
                    user_id = get_jwt_identity()
                    if user_id:
                        log_data['user_id'] = user_id
                except:
                    pass
                
                # Log level based on status code
                if response.status_code >= 500:
                    logging.getLogger('request').error('Request completed', extra={'extra': log_data})
                elif response.status_code >= 400:
                    logging.getLogger('request').warning('Request completed', extra={'extra': log_data})
                else:
                    logging.getLogger('request').info('Request completed', extra={'extra': log_data})
                
                # Add request ID to response headers
                response.headers['X-Request-ID'] = g.get('request_id', 'unknown')
            
            return response


def get_request_id():
    """Get current request ID, or generate one if not in request context."""
    if has_request_context():
        return getattr(g, 'request_id', None)
    return str(uuid.uuid4())[:8]


def log_with_context(logger, level, message, **extra):
    """Log a message with request context."""
    log_data = {'extra': extra}
    
    if has_request_context():
        log_data['extra']['request_id'] = get_request_id()
    
    getattr(logger, level)(message, extra=log_data)


# Global request logger instance
request_logger = RequestLogger()


def init_request_logging(app):
    """Initialize request logging with app."""
    request_logger.init_app(app)
    return request_logger
