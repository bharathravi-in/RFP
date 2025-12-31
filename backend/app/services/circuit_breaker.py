"""
Circuit Breaker Pattern for External Service Calls

Provides resilience for external API calls (LLMs, etc.) with:
- Automatic failure detection
- Circuit states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
- Configurable thresholds and timeouts
- Retry with exponential backoff
"""
import time
import logging
import functools
from enum import Enum
from threading import Lock
from typing import Callable, Any, Optional, Dict
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation, requests pass through
    OPEN = "open"          # Failing, requests fail fast
    HALF_OPEN = "half_open"  # Testing, limited requests allowed


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5          # Failures before opening
    recovery_timeout: float = 60.0      # Seconds before trying again
    half_open_max_calls: int = 3        # Test calls in half-open state
    request_timeout: float = 60.0       # Timeout for individual requests
    expected_exceptions: tuple = (Exception,)  # Exceptions to track


@dataclass
class CircuitBreakerStats:
    """Statistics for circuit breaker monitoring."""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0
    last_failure_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    current_state: CircuitState = CircuitState.CLOSED
    consecutive_failures: int = 0
    consecutive_successes: int = 0


class CircuitBreaker:
    """
    Circuit breaker implementation for external service calls.
    
    Usage:
        breaker = CircuitBreaker("openai_api")
        
        @breaker
        def call_api():
            return external_service.call()
        
        # Or manual usage:
        with breaker:
            result = external_service.call()
    """
    
    # Registry of all circuit breakers for monitoring
    _registry: Dict[str, 'CircuitBreaker'] = {}
    
    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._half_open_calls = 0
        self._lock = Lock()
        self._stats = CircuitBreakerStats()
        
        # Register for monitoring
        CircuitBreaker._registry[name] = self
        logger.info(f"CircuitBreaker '{name}' initialized with config: {self.config}")
    
    @property
    def state(self) -> CircuitState:
        """Get current circuit state, handling automatic recovery."""
        with self._lock:
            if self._state == CircuitState.OPEN:
                # Check if we should try half-open
                if self._should_attempt_reset():
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    logger.info(f"CircuitBreaker '{self.name}' transitioning to HALF_OPEN")
            return self._state
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        if self._last_failure_time is None:
            return True
        return time.time() - self._last_failure_time >= self.config.recovery_timeout
    
    def _record_success(self):
        """Record a successful call."""
        with self._lock:
            self._success_count += 1
            self._failure_count = 0
            self._stats.successful_calls += 1
            self._stats.last_success_time = datetime.utcnow()
            self._stats.consecutive_successes += 1
            self._stats.consecutive_failures = 0
            
            if self._state == CircuitState.HALF_OPEN:
                self._half_open_calls += 1
                if self._half_open_calls >= self.config.half_open_max_calls:
                    self._state = CircuitState.CLOSED
                    logger.info(f"CircuitBreaker '{self.name}' recovered, now CLOSED")
    
    def _record_failure(self, exc: Exception):
        """Record a failed call."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            self._stats.failed_calls += 1
            self._stats.last_failure_time = datetime.utcnow()
            self._stats.consecutive_failures += 1
            self._stats.consecutive_successes = 0
            
            if self._state == CircuitState.HALF_OPEN:
                # Single failure in half-open reopens circuit
                self._state = CircuitState.OPEN
                logger.warning(f"CircuitBreaker '{self.name}' back to OPEN after half-open failure")
            elif self._failure_count >= self.config.failure_threshold:
                self._state = CircuitState.OPEN
                logger.warning(
                    f"CircuitBreaker '{self.name}' opened after {self._failure_count} failures. "
                    f"Last error: {exc}"
                )
    
    def __call__(self, func: Callable) -> Callable:
        """Decorator to wrap functions with circuit breaker."""
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return self.call(func, *args, **kwargs)
        return wrapper
    
    def __enter__(self):
        """Context manager entry - check if circuit allows calls."""
        if not self.allow_request():
            raise CircuitOpenError(f"Circuit '{self.name}' is OPEN")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - record success or failure."""
        if exc_type is None:
            self._record_success()
        elif isinstance(exc_val, self.config.expected_exceptions):
            self._record_failure(exc_val)
        return False  # Don't suppress exceptions
    
    def allow_request(self) -> bool:
        """Check if a request should be allowed."""
        state = self.state
        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.HALF_OPEN:
            with self._lock:
                if self._half_open_calls < self.config.half_open_max_calls:
                    return True
            return False
        return False  # OPEN state
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection."""
        self._stats.total_calls += 1
        
        if not self.allow_request():
            self._stats.rejected_calls += 1
            raise CircuitOpenError(
                f"Circuit '{self.name}' is OPEN. "
                f"Retry after {self.config.recovery_timeout}s"
            )
        
        try:
            result = func(*args, **kwargs)
            self._record_success()
            return result
        except self.config.expected_exceptions as e:
            self._record_failure(e)
            raise
    
    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics."""
        self._stats.current_state = self.state
        return {
            'name': self.name,
            'state': self._stats.current_state.value,
            'total_calls': self._stats.total_calls,
            'successful_calls': self._stats.successful_calls,
            'failed_calls': self._stats.failed_calls,
            'rejected_calls': self._stats.rejected_calls,
            'consecutive_failures': self._stats.consecutive_failures,
            'last_failure': self._stats.last_failure_time.isoformat() if self._stats.last_failure_time else None,
            'last_success': self._stats.last_success_time.isoformat() if self._stats.last_success_time else None,
        }
    
    def reset(self):
        """Manually reset the circuit breaker."""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._half_open_calls = 0
            logger.info(f"CircuitBreaker '{self.name}' manually reset")
    
    @classmethod
    def get_all_stats(cls) -> Dict[str, Dict]:
        """Get stats for all registered circuit breakers."""
        return {name: cb.get_stats() for name, cb in cls._registry.items()}


class CircuitOpenError(Exception):
    """Raised when circuit is open and request is rejected."""
    pass


class TimeoutError(Exception):
    """Raised when operation times out."""
    pass


def with_timeout(timeout_seconds: float):
    """
    Decorator to add timeout to a function.
    
    Uses threading for sync functions.
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import concurrent.futures
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(func, *args, **kwargs)
                try:
                    return future.result(timeout=timeout_seconds)
                except concurrent.futures.TimeoutError:
                    raise TimeoutError(
                        f"Operation timed out after {timeout_seconds}s"
                    )
        return wrapper
    return decorator


def with_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    retryable_exceptions: tuple = (Exception,)
):
    """
    Decorator for retry with exponential backoff.
    
    Args:
        max_retries: Maximum retry attempts
        base_delay: Initial delay between retries
        max_delay: Maximum delay between retries
        exponential_base: Multiplier for exponential backoff
        retryable_exceptions: Exceptions to retry on
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    
                    if attempt >= max_retries:
                        logger.warning(
                            f"All {max_retries} retries exhausted for {func.__name__}"
                        )
                        raise
                    
                    delay = min(
                        base_delay * (exponential_base ** attempt),
                        max_delay
                    )
                    logger.info(
                        f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                        f"after {delay:.1f}s. Error: {e}"
                    )
                    time.sleep(delay)
            
            raise last_exception
        return wrapper
    return decorator


# Pre-configured circuit breakers for common services
llm_circuit_breaker = CircuitBreaker(
    "llm_api",
    CircuitBreakerConfig(
        failure_threshold=5,
        recovery_timeout=60.0,
        request_timeout=60.0,
    )
)

embedding_circuit_breaker = CircuitBreaker(
    "embedding_api",
    CircuitBreakerConfig(
        failure_threshold=5,
        recovery_timeout=30.0,
        request_timeout=30.0,
    )
)
