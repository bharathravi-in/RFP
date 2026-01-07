"""
Provider Fallback Chain & Circuit Breaker

Implements automatic fallback to backup providers when primary fails.
"""
import os
import time
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from threading import Lock
from functools import wraps

logger = logging.getLogger(__name__)


@dataclass
class CircuitBreakerState:
    """State for a circuit breaker."""
    failures: int = 0
    last_failure_time: float = 0
    is_open: bool = False
    
    # Configuration
    failure_threshold: int = 5
    recovery_timeout: int = 30  # seconds


@dataclass
class ProviderConfig:
    """Configuration for a provider in the fallback chain."""
    provider: str
    model: str
    api_key: str = None
    base_url: str = None
    priority: int = 0
    
    # Per-provider circuit breaker
    circuit_breaker: CircuitBreakerState = field(default_factory=CircuitBreakerState)


class ProviderFallbackChain:
    """
    Manages a chain of LLM providers with automatic fallback.
    
    Features:
    - Ordered provider chain by priority
    - Circuit breaker per provider
    - Automatic retry with exponential backoff
    - Health monitoring
    """
    
    def __init__(
        self,
        providers: List[ProviderConfig] = None,
        max_retries: int = 3,
        base_delay: float = 1.0
    ):
        self.providers = sorted(providers or [], key=lambda p: p.priority)
        self.max_retries = max_retries
        self.base_delay = base_delay
        self._lock = Lock()
        self._provider_instances = {}
    
    def _get_provider_instance(self, config: ProviderConfig):
        """Get or create provider instance."""
        key = f"{config.provider}:{config.model}"
        
        if key not in self._provider_instances:
            from app.services.llm_providers import LLMProviderFactory
            
            self._provider_instances[key] = LLMProviderFactory.create(
                provider=config.provider,
                api_key=config.api_key,
                model=config.model,
                base_url=config.base_url
            )
        
        return self._provider_instances[key]
    
    def _is_circuit_open(self, config: ProviderConfig) -> bool:
        """Check if circuit breaker is open for a provider."""
        cb = config.circuit_breaker
        
        if not cb.is_open:
            return False
        
        # Check if recovery timeout has passed
        if time.time() - cb.last_failure_time > cb.recovery_timeout:
            with self._lock:
                cb.is_open = False
                cb.failures = 0
            logger.info(f"Circuit breaker closed for {config.provider}/{config.model}")
            return False
        
        return True
    
    def _record_failure(self, config: ProviderConfig, error: Exception):
        """Record a failure and potentially open circuit breaker."""
        with self._lock:
            cb = config.circuit_breaker
            cb.failures += 1
            cb.last_failure_time = time.time()
            
            if cb.failures >= cb.failure_threshold:
                cb.is_open = True
                logger.warning(
                    f"Circuit breaker opened for {config.provider}/{config.model} "
                    f"after {cb.failures} failures"
                )
    
    def _record_success(self, config: ProviderConfig):
        """Record a success and reset failure count."""
        with self._lock:
            config.circuit_breaker.failures = 0
    
    def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate content using fallback chain.
        
        Tries providers in order, falling back on failure.
        
        Args:
            prompt: The prompt to generate from
            **kwargs: Additional generation parameters
            
        Returns:
            Generated content
            
        Raises:
            Exception: If all providers fail
        """
        last_error = None
        
        for config in self.providers:
            # Skip if circuit is open
            if self._is_circuit_open(config):
                logger.debug(f"Skipping {config.provider}/{config.model} - circuit open")
                continue
            
            # Try with retries
            for attempt in range(self.max_retries):
                try:
                    provider = self._get_provider_instance(config)
                    result = provider.generate_content(prompt, **kwargs)
                    
                    self._record_success(config)
                    return result
                    
                except Exception as e:
                    last_error = e
                    logger.warning(
                        f"Provider {config.provider}/{config.model} failed "
                        f"(attempt {attempt + 1}/{self.max_retries}): {e}"
                    )
                    
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2 ** attempt)
                        time.sleep(delay)
            
            # All retries failed
            self._record_failure(config, last_error)
        
        # All providers failed
        raise Exception(f"All providers failed. Last error: {last_error}")
    
    def get_health(self) -> Dict[str, Any]:
        """Get health status of all providers."""
        statuses = []
        for config in self.providers:
            cb = config.circuit_breaker
            statuses.append({
                'provider': config.provider,
                'model': config.model,
                'priority': config.priority,
                'circuit_open': cb.is_open,
                'failures': cb.failures,
                'healthy': not cb.is_open
            })
        
        return {
            'providers': statuses,
            'active_providers': sum(1 for s in statuses if s['healthy'])
        }


# Default fallback chain (configurable via environment)
_default_chain = None


def get_fallback_chain(org_id: int = None) -> ProviderFallbackChain:
    """
    Get the fallback chain for an organization.
    
    Loads configuration from agents.yaml or database.
    """
    global _default_chain
    
    if _default_chain is None:
        # Build default chain from environment
        providers = []
        
        # Primary: LiteLLM
        if os.environ.get('LITELLM_API_KEY'):
            providers.append(ProviderConfig(
                provider='litellm',
                model=os.environ.get('LITELLM_MODEL', 'gpt-4o-mini'),
                api_key=os.environ.get('LITELLM_API_KEY'),
                base_url=os.environ.get('LITELLM_BASE_URL'),
                priority=0
            ))
        
        # Fallback: OpenAI
        if os.environ.get('OPENAI_API_KEY'):
            providers.append(ProviderConfig(
                provider='openai',
                model='gpt-4o-mini',
                api_key=os.environ.get('OPENAI_API_KEY'),
                priority=1
            ))
        
        # Fallback: Google
        if os.environ.get('GOOGLE_API_KEY'):
            providers.append(ProviderConfig(
                provider='google',
                model='gemini-1.5-flash',
                api_key=os.environ.get('GOOGLE_API_KEY'),
                priority=2
            ))
        
        _default_chain = ProviderFallbackChain(providers)
    
    return _default_chain


def with_fallback(func):
    """
    Decorator to add fallback chain to a function.
    
    The decorated function should accept a 'provider' kwarg.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        chain = get_fallback_chain()
        prompt = kwargs.get('prompt') or (args[0] if args else None)
        
        if not prompt:
            return func(*args, **kwargs)
        
        return chain.generate_content(prompt, **kwargs)
    
    return wrapper
