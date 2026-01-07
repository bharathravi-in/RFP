"""
Structured JSON Logging Configuration

Provides structured logging with correlation IDs for distributed tracing.
"""
import os
import sys
import logging
import json
from datetime import datetime
from typing import Optional
from functools import wraps
import uuid

# Configuration
LOG_FORMAT = os.environ.get('LOG_FORMAT', 'json')  # 'json' or 'text'
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

# Thread-local storage for correlation ID
import threading
_correlation_id = threading.local()


def get_correlation_id() -> str:
    """Get current correlation ID or generate one."""
    if not hasattr(_correlation_id, 'value') or _correlation_id.value is None:
        _correlation_id.value = str(uuid.uuid4())
    return _correlation_id.value


def set_correlation_id(correlation_id: str):
    """Set correlation ID for current thread."""
    _correlation_id.value = correlation_id


def clear_correlation_id():
    """Clear correlation ID."""
    _correlation_id.value = None


class JSONFormatter(logging.Formatter):
    """
    JSON log formatter for structured logging.
    
    Output format:
    {
        "timestamp": "2025-12-27T12:00:00.000Z",
        "level": "INFO",
        "logger": "app.services.ai_service",
        "message": "Generated answer",
        "correlation_id": "abc123",
        "extra": {...}
    }
    """
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'correlation_id': get_correlation_id()
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in ('name', 'msg', 'args', 'created', 'levelname', 
                          'levelno', 'pathname', 'filename', 'module',
                          'lineno', 'funcName', 'exc_info', 'exc_text',
                          'stack_info', 'message', 'msecs', 'relativeCreated',
                          'thread', 'threadName', 'processName', 'process'):
                extra_fields[key] = value
        
        if extra_fields:
            log_data['extra'] = extra_fields
        
        return json.dumps(log_data, default=str)


def setup_logging(app=None):
    """
    Configure structured logging for the application.
    
    Args:
        app: Flask app instance (optional)
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    
    if LOG_FORMAT == 'json':
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s [%(correlation_id)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
    
    root_logger.addHandler(handler)
    
    # If Flask app provided, add request middleware
    if app:
        @app.before_request
        def add_correlation_id():
            from flask import request, g
            # Get from header or generate new
            correlation_id = request.headers.get('X-Correlation-ID', str(uuid.uuid4()))
            set_correlation_id(correlation_id)
            g.correlation_id = correlation_id
        
        @app.after_request
        def add_correlation_header(response):
            from flask import g
            if hasattr(g, 'correlation_id'):
                response.headers['X-Correlation-ID'] = g.correlation_id
            return response
    
    logging.info("Structured logging configured", extra={'format': LOG_FORMAT})


def log_with_context(**context):
    """
    Decorator to add context to all log messages within a function.
    
    Usage:
        @log_with_context(agent='answer_generator', project_id=123)
        def generate_answer():
            logger.info("Starting generation")  # Will include agent and project_id
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Store context in thread-local
            old_factory = logging.getLogRecordFactory()
            
            def record_factory(*args_, **kwargs_):
                record = old_factory(*args_, **kwargs_)
                for key, value in context.items():
                    setattr(record, key, value)
                return record
            
            logging.setLogRecordFactory(record_factory)
            try:
                return func(*args, **kwargs)
            finally:
                logging.setLogRecordFactory(old_factory)
        
        return wrapper
    return decorator


# Convenience logger
def get_logger(name: str) -> logging.Logger:
    """Get a logger with proper configuration."""
    return logging.getLogger(name)
