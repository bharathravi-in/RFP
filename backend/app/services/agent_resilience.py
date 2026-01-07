"""
Agent Resilience Service - Retry Logic, Circuit Breakers, and Timeouts

Provides production-grade resilience patterns for AI agents:
1. Retry with exponential backoff
2. Circuit breaker for failure isolation
3. Configurable timeouts
4. Fallback handling
"""
import asyncio
import time
import functools
from typing import Optional, Callable, Any, TypeVar, Dict
from dataclasses import dataclass, field
from enum import Enum
from threading import Lock
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Failing, reject calls
    HALF_OPEN = "half_open" # Testing if recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5       # Failures before opening
    success_threshold: int = 2       # Successes to close from half-open
    timeout_seconds: float = 30.0    # Time before trying half-open
    

@dataclass
class RetryConfig:
    """Configuration for retry logic."""
    max_retries: int = 3
    base_delay: float = 1.0          # Initial delay in seconds
    max_delay: float = 30.0          # Maximum delay
    exponential_base: float = 2.0    # Multiplier for exponential backoff
    jitter: bool = True              # Add randomness to prevent thundering herd
    retryable_exceptions: tuple = (Exception,)  # Which exceptions to retry


@dataclass
class AgentTimeoutConfig:
    """Configuration for agent timeouts."""
    default_timeout: float = 60.0    # Default timeout in seconds
    document_analysis: float = 120.0 # Complex document analysis
    answer_generation: float = 90.0  # Answer generation with RAG
    export_generation: float = 180.0 # PDF/PPTX generation
    simple_validation: float = 30.0  # Quick validation checks


@dataclass
class CircuitBreakerState:
    """Track circuit breaker state for an agent."""
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0.0
    lock: Lock = field(default_factory=Lock)


class AgentResilienceService:
    """
    Centralized resilience service for all AI agents.
    Provides retry, circuit breaker, and timeout functionality.
    """
    
    def __init__(self):
        self._circuit_breakers: Dict[str, CircuitBreakerState] = {}
        self._circuit_config = CircuitBreakerConfig()
        self._retry_config = RetryConfig()
        self._timeout_config = AgentTimeoutConfig()
        self._lock = Lock()
    
    # ==========================================
    # Circuit Breaker
    # ==========================================
    
    def _get_circuit_state(self, agent_name: str) -> CircuitBreakerState:
        """Get or create circuit breaker state for an agent."""
        with self._lock:
            if agent_name not in self._circuit_breakers:
                self._circuit_breakers[agent_name] = CircuitBreakerState()
            return self._circuit_breakers[agent_name]
    
    def is_circuit_open(self, agent_name: str) -> bool:
        """Check if circuit is open (should reject calls)."""
        state = self._get_circuit_state(agent_name)
        
        with state.lock:
            if state.state == CircuitState.CLOSED:
                return False
            
            if state.state == CircuitState.OPEN:
                # Check if timeout has passed
                elapsed = time.time() - state.last_failure_time
                if elapsed >= self._circuit_config.timeout_seconds:
                    state.state = CircuitState.HALF_OPEN
                    state.success_count = 0
                    logger.info(f"Circuit breaker for {agent_name} moved to HALF_OPEN")
                    return False
                return True
            
            # HALF_OPEN - allow calls through to test
            return False
    
    def record_success(self, agent_name: str) -> None:
        """Record a successful call."""
        state = self._get_circuit_state(agent_name)
        
        with state.lock:
            if state.state == CircuitState.HALF_OPEN:
                state.success_count += 1
                if state.success_count >= self._circuit_config.success_threshold:
                    state.state = CircuitState.CLOSED
                    state.failure_count = 0
                    logger.info(f"Circuit breaker for {agent_name} CLOSED (recovered)")
            elif state.state == CircuitState.CLOSED:
                # Reset failure count on success
                state.failure_count = 0
    
    def record_failure(self, agent_name: str) -> None:
        """Record a failed call."""
        state = self._get_circuit_state(agent_name)
        
        with state.lock:
            state.failure_count += 1
            state.last_failure_time = time.time()
            
            if state.state == CircuitState.HALF_OPEN:
                # Immediate trip back to open
                state.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker for {agent_name} OPEN (failed during half-open)")
            elif state.failure_count >= self._circuit_config.failure_threshold:
                state.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker for {agent_name} OPEN (threshold reached: {state.failure_count})")
    
    def get_circuit_status(self, agent_name: str) -> dict:
        """Get current circuit breaker status."""
        state = self._get_circuit_state(agent_name)
        with state.lock:
            return {
                'agent': agent_name,
                'state': state.state.value,
                'failure_count': state.failure_count,
                'success_count': state.success_count,
                'last_failure': state.last_failure_time
            }
    
    def get_all_circuit_status(self) -> list:
        """Get status of all circuit breakers."""
        return [self.get_circuit_status(name) for name in self._circuit_breakers]
    
    def reset_circuit(self, agent_name: str) -> None:
        """Manually reset a circuit breaker."""
        state = self._get_circuit_state(agent_name)
        with state.lock:
            state.state = CircuitState.CLOSED
            state.failure_count = 0
            state.success_count = 0
            logger.info(f"Circuit breaker for {agent_name} manually reset")
    
    # ==========================================
    # Retry Logic
    # ==========================================
    
    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt with exponential backoff."""
        import random
        
        delay = self._retry_config.base_delay * (
            self._retry_config.exponential_base ** attempt
        )
        delay = min(delay, self._retry_config.max_delay)
        
        if self._retry_config.jitter:
            # Add ±25% jitter
            jitter = delay * 0.25 * (random.random() * 2 - 1)
            delay += jitter
        
        return max(0, delay)
    
    def should_retry(self, exception: Exception, attempt: int) -> bool:
        """Determine if we should retry based on exception and attempt count."""
        if attempt >= self._retry_config.max_retries:
            return False
        return isinstance(exception, self._retry_config.retryable_exceptions)
    
    # ==========================================
    # Timeouts
    # ==========================================
    
    def get_timeout(self, agent_type: str) -> float:
        """Get appropriate timeout for agent type."""
        timeout_map = {
            'document_analyzer': self._timeout_config.document_analysis,
            'question_extractor': self._timeout_config.document_analysis,
            'answer_generator': self._timeout_config.answer_generation,
            'proposal_writer': self._timeout_config.answer_generation,
            'knowledge_base': self._timeout_config.answer_generation,
            'ppt_generator': self._timeout_config.export_generation,
            'doc_generator': self._timeout_config.export_generation,
            'pdf_export': self._timeout_config.export_generation,
            'answer_validator': self._timeout_config.simple_validation,
            'compliance_checker': self._timeout_config.simple_validation,
            'quality_reviewer': self._timeout_config.simple_validation,
        }
        return timeout_map.get(agent_type, self._timeout_config.default_timeout)


# Singleton instance
_resilience_service: Optional[AgentResilienceService] = None


def get_resilience_service() -> AgentResilienceService:
    """Get singleton resilience service instance."""
    global _resilience_service
    if _resilience_service is None:
        _resilience_service = AgentResilienceService()
    return _resilience_service


# ==========================================
# Decorators for Agent Functions
# ==========================================

def with_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    retryable_exceptions: tuple = (Exception,)
):
    """
    Decorator to add retry logic to agent functions.
    
    Usage:
        @with_retry(max_retries=3)
        def my_agent_function():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            service = get_resilience_service()
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    result = func(*args, **kwargs)
                    return result
                except retryable_exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        delay = service.calculate_delay(attempt)
                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {delay:.2f}s (error: {str(e)[:100]})"
                        )
                        time.sleep(delay)
                    else:
                        logger.error(f"All {max_retries} retries failed for {func.__name__}")
            
            raise last_exception
        return wrapper
    return decorator


def with_circuit_breaker(agent_name: str):
    """
    Decorator to add circuit breaker to agent functions.
    
    Usage:
        @with_circuit_breaker("answer_generator")
        def generate_answer():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            service = get_resilience_service()
            
            # Check if circuit is open
            if service.is_circuit_open(agent_name):
                raise CircuitBreakerOpenError(
                    f"Circuit breaker is OPEN for {agent_name}. "
                    f"Service temporarily unavailable."
                )
            
            try:
                result = func(*args, **kwargs)
                service.record_success(agent_name)
                return result
            except Exception as e:
                service.record_failure(agent_name)
                raise
        return wrapper
    return decorator


def with_timeout(timeout_seconds: float = None, agent_type: str = None):
    """
    Decorator to add timeout to agent functions.
    
    Usage:
        @with_timeout(timeout_seconds=60)
        def my_agent_function():
            ...
        
        @with_timeout(agent_type="answer_generator")
        def generate_answer():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            import signal
            
            service = get_resilience_service()
            actual_timeout = timeout_seconds or service.get_timeout(agent_type or func.__name__)
            
            def timeout_handler(signum, frame):
                raise AgentTimeoutError(
                    f"Agent {func.__name__} timed out after {actual_timeout}s"
                )
            
            # Set the timeout (Unix only)
            try:
                old_handler = signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(int(actual_timeout))
            except (ValueError, AttributeError):
                # Windows or threading context - use threading timeout
                import threading
                import queue
                
                result_queue = queue.Queue()
                exception_queue = queue.Queue()
                
                def run_with_result():
                    try:
                        result = func(*args, **kwargs)
                        result_queue.put(result)
                    except Exception as e:
                        exception_queue.put(e)
                
                thread = threading.Thread(target=run_with_result)
                thread.start()
                thread.join(timeout=actual_timeout)
                
                if thread.is_alive():
                    raise AgentTimeoutError(
                        f"Agent {func.__name__} timed out after {actual_timeout}s"
                    )
                
                if not exception_queue.empty():
                    raise exception_queue.get()
                
                return result_queue.get()
            
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)
        
        return wrapper
    return decorator


def resilient_agent(
    agent_name: str,
    max_retries: int = 3,
    timeout_seconds: float = None,
    enable_circuit_breaker: bool = True
):
    """
    Combined decorator for full agent resilience.
    
    Applies: Timeout → Circuit Breaker → Retry (in that order)
    
    Usage:
        @resilient_agent("answer_generator", max_retries=3, timeout_seconds=90)
        def generate_answer():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        # Apply decorators in reverse order (innermost first)
        wrapped = func
        
        # Retry is innermost
        wrapped = with_retry(max_retries=max_retries)(wrapped)
        
        # Circuit breaker wraps retry
        if enable_circuit_breaker:
            wrapped = with_circuit_breaker(agent_name)(wrapped)
        
        # Timeout is outermost
        if timeout_seconds:
            wrapped = with_timeout(timeout_seconds=timeout_seconds)(wrapped)
        
        return wrapped
    return decorator


# ==========================================
# Custom Exceptions
# ==========================================

class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open and rejecting calls."""
    pass


class AgentTimeoutError(Exception):
    """Raised when agent execution exceeds timeout."""
    pass


class AgentRetryExhaustedError(Exception):
    """Raised when all retry attempts are exhausted."""
    pass
