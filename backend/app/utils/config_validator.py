"""
Configuration validation at application startup.

Validates that all required environment variables are set
and have valid values before the application starts.
"""
import os
import sys
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""
    pass


# Required configuration with validation rules
REQUIRED_CONFIG = {
    # Database
    'DATABASE_URL': {
        'required': True,
        'description': 'PostgreSQL connection string',
        'example': 'postgresql://user:pass@localhost:5432/rfp_db'
    },
    
    # Security
    'SECRET_KEY': {
        'required': True,
        'min_length': 16,
        'description': 'Flask secret key for session encryption',
        'example': 'your-super-secret-key-here'
    },
    'JWT_SECRET_KEY': {
        'required': True,
        'min_length': 16,
        'description': 'JWT signing secret',
        'example': 'your-jwt-secret-key-here'
    },
}

# Optional configuration with defaults
OPTIONAL_CONFIG = {
    'REDIS_URL': {
        'default': 'redis://localhost:6379/0',
        'description': 'Redis connection string'
    },
    'LOG_LEVEL': {
        'default': 'INFO',
        'allowed_values': ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        'description': 'Logging level'
    },
    'STORAGE_TYPE': {
        'default': 'local',
        'allowed_values': ['local', 'gcp', 's3'],
        'description': 'File storage backend'
    },
    'RATELIMIT_ENABLED': {
        'default': 'true',
        'allowed_values': ['true', 'false'],
        'description': 'Enable API rate limiting'
    },
}

# Conditional requirements
CONDITIONAL_CONFIG = {
    'gcp': {  # When STORAGE_TYPE=gcp
        'GCP_STORAGE_BUCKET': {
            'required': True,
            'description': 'GCP bucket name'
        }
    },
    's3': {  # When STORAGE_TYPE=s3
        'S3_BUCKET_NAME': {
            'required': True,
            'description': 'S3 bucket name'
        },
        'AWS_REGION': {
            'required': True,
            'description': 'AWS region'
        }
    }
}


def validate_config(fail_fast: bool = True) -> Dict[str, Any]:
    """
    Validate application configuration at startup.
    
    Args:
        fail_fast: If True, exits on first error; otherwise collects all errors
    
    Returns:
        Dict with validation results
    
    Raises:
        ConfigValidationError: If validation fails and fail_fast is True
    """
    errors = []
    warnings = []
    config_values = {}
    
    # Check required config
    for key, rules in REQUIRED_CONFIG.items():
        value = os.environ.get(key)
        
        if not value and rules.get('required', True):
            errors.append(f"Missing required config: {key} - {rules['description']}")
            continue
        
        if value:
            # Check minimum length
            min_len = rules.get('min_length', 0)
            if len(value) < min_len:
                errors.append(f"{key} must be at least {min_len} characters")
        
        config_values[key] = value
    
    # Check optional config, apply defaults
    for key, rules in OPTIONAL_CONFIG.items():
        value = os.environ.get(key, rules.get('default'))
        
        # Validate allowed values
        allowed = rules.get('allowed_values')
        if allowed and value not in allowed:
            warnings.append(f"{key}={value} is not in allowed values: {allowed}")
        
        config_values[key] = value
    
    # Check conditional requirements
    storage_type = os.environ.get('STORAGE_TYPE', 'local')
    if storage_type in CONDITIONAL_CONFIG:
        for key, rules in CONDITIONAL_CONFIG[storage_type].items():
            value = os.environ.get(key)
            if not value and rules.get('required', True):
                errors.append(f"Missing required config for {storage_type}: {key} - {rules['description']}")
    
    # Validate specific values
    if 'DATABASE_URL' in config_values and config_values['DATABASE_URL']:
        if not config_values['DATABASE_URL'].startswith(('postgresql://', 'postgres://')):
            warnings.append("DATABASE_URL should use postgresql:// scheme")
    
    # Log warnings
    for warning in warnings:
        logger.warning(f"Config warning: {warning}")
    
    # Handle errors
    if errors:
        error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        logger.error(error_msg)
        
        if fail_fast:
            print(error_msg, file=sys.stderr)
            print("\nPlease check your .env file or environment variables.", file=sys.stderr)
            print("See .env.example for reference.", file=sys.stderr)
            raise ConfigValidationError(error_msg)
    
    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings,
        'config': config_values
    }


def print_config_status():
    """Print configuration status to console."""
    print("\n" + "="*50)
    print("Configuration Status")
    print("="*50)
    
    for key in list(REQUIRED_CONFIG.keys()) + list(OPTIONAL_CONFIG.keys()):
        value = os.environ.get(key)
        if value:
            # Mask sensitive values
            if any(s in key.lower() for s in ['secret', 'password', 'key', 'token']):
                display = value[:4] + '***' + value[-4:] if len(value) > 8 else '***'
            else:
                display = value[:50] + '...' if len(value) > 50 else value
            status = '✓'
        else:
            default = OPTIONAL_CONFIG.get(key, {}).get('default', 'NOT SET')
            display = f"(default: {default})" if default != 'NOT SET' else 'NOT SET'
            status = '⚠' if key in REQUIRED_CONFIG else '○'
        
        print(f"  {status} {key}: {display}")
    
    print("="*50 + "\n")


def init_config_validation(app):
    """
    Initialize configuration validation for Flask app.
    
    Call this in create_app() before starting the server.
    """
    try:
        result = validate_config(fail_fast=False)
        
        if not result['valid']:
            logger.error(f"Config errors: {result['errors']}")
            # In development, just warn; in production, fail
            if os.environ.get('FLASK_ENV') == 'production':
                raise ConfigValidationError("Invalid configuration for production")
        
        if result['warnings']:
            for w in result['warnings']:
                logger.warning(f"Config: {w}")
        
        return result
    except Exception as e:
        logger.error(f"Config validation error: {e}")
        raise
