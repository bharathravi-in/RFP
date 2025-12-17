"""
Retry Decorator for Agent Fault Tolerance

Provides exponential backoff retry logic and model fallback for AI operations.
"""
import logging
import time
from functools import wraps
from typing import Callable, Any, List, Optional

logger = logging.getLogger(__name__)


class RetryConfig:
    """Configuration for retry behavior."""
    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 10.0,
        exponential_base: float = 2.0,
        exceptions: tuple = (Exception,)
    ):
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.exceptions = exceptions


def with_retry(
    config: Optional[RetryConfig] = None,
    fallback_models: Optional[List[str]] = None
):
    """
    Decorator that retries a function with exponential backoff.
    
    Args:
        config: Retry configuration (uses defaults if None)
        fallback_models: List of fallback model names to try (e.g., ['gemini-1.5-pro'])
        
    Usage:
        @with_retry(config=RetryConfig(max_attempts=3), fallback_models=['gemini-1.5-pro'])
        def my_ai_function(text, model='gemini-1.5-flash'):
            # AI call here
            pass
    """
    if config is None:
        config = RetryConfig()
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            # Try primary model with retries
            for attempt in range(config.max_attempts):
                try:
                    return func(*args, **kwargs)
                except config.exceptions as e:
                    last_exception = e
                    logger.warning(
                        f"Attempt {attempt + 1}/{config.max_attempts} failed for {func.__name__}: {str(e)}"
                    )
                    
                    if attempt < config.max_attempts - 1:
                        # Calculate delay with exponential backoff
                        delay = min(
                            config.initial_delay * (config.exponential_base ** attempt),
                            config.max_delay
                        )
                        logger.info(f"Retrying in {delay:.2f}s...")
                        time.sleep(delay)
            
            # Try fallback models if primary failed
            if fallback_models:
                logger.warning(f"Primary model failed, attempting fallbacks: {fallback_models}")
                
                for fallback_model in fallback_models:
                    try:
                        # Update model in kwargs if present
                        if 'model' in kwargs:
                            kwargs['model'] = fallback_model
                        elif hasattr(args[0], 'config') and hasattr(args[0].config, 'model_name'):
                            # Update agent's config model temporarily
                            original_model = args[0].config.model_name
                            args[0].config.model_name = fallback_model
                            
                        logger.info(f"Trying fallback model: {fallback_model}")
                        result = func(*args, **kwargs)
                        
                        # Restore original model if changed
                        if hasattr(args[0], 'config') and 'original_model' in locals():
                            args[0].config.model_name = original_model
                        
                        logger.info(f"Fallback model {fallback_model} succeeded")
                        return result
                        
                    except Exception as e:
                        logger.warning(f"Fallback model {fallback_model} failed: {str(e)}")
                        last_exception = e
                        continue
            
            # All retries and fallbacks failed
            logger.error(f"All retry attempts failed for {func.__name__}")
            raise last_exception
        
        return wrapper
    return decorator


def with_graceful_degradation(fallback_value: Any = None):
    """
    Decorator that returns a fallback value instead of raising exceptions.
    
    Useful for non-critical operations where we want to continue even if they fail.
    
    Args:
        fallback_value: Value to return if function fails
        
    Usage:
        @with_graceful_degradation(fallback_value={})
        def optional_enrichment():
            # Some optional operation
            pass
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.warning(
                    f"Function {func.__name__} failed gracefully: {str(e)}. "
                    f"Returning fallback value: {fallback_value}"
                )
                return fallback_value
        return wrapper
    return decorator
