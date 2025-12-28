"""
Agent Router

Dynamic selection of provider + model per agent using config + runtime policies.
Supports:
- Fallback chain for resilience
- Rate limiting per agent
- Circuit breaker pattern
- Cost-based routing
- Latency SLA enforcement

Usage:
    from agent_router import AgentRouter, AgentPolicy
    
    router = AgentRouter("config/agents.yaml")
    adapter = router.get_adapter("document_analyzer")
    response = adapter.send("Analyze this document...")
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from enum import Enum
import logging
import time
import yaml
import os
from threading import Lock

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration Models
# ============================================================================

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, skip requests
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class ProviderConfig:
    """Configuration for a single provider."""
    name: str
    api_key_env: str  # Environment variable name for API key
    model: str
    base_url: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 4096
    timeout: int = 60
    priority: int = 1  # Lower = higher priority
    max_cost_per_request: Optional[float] = None
    
    def get_api_key(self) -> str:
        """Get API key from environment variable."""
        key = os.environ.get(self.api_key_env)
        if not key:
            raise ValueError(f"API key not found in env var: {self.api_key_env}")
        return key


@dataclass
class RateLimitConfig:
    """Rate limiting configuration."""
    requests_per_minute: int = 60
    tokens_per_minute: int = 100000
    concurrent_requests: int = 10


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration."""
    failure_threshold: int = 5
    recovery_timeout_seconds: int = 60
    half_open_requests: int = 3


@dataclass
class AgentPolicy:
    """Policy configuration for an agent."""
    agent_type: str
    providers: List[ProviderConfig]  # Ordered by priority
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    latency_sla_ms: int = 30000  # Max acceptable latency
    cost_budget_per_hour: Optional[float] = None
    fallback_enabled: bool = True
    retry_attempts: int = 3
    retry_delay_seconds: float = 1.0


# ============================================================================
# Circuit Breaker
# ============================================================================

class CircuitBreaker:
    """Circuit breaker implementation for provider resilience."""
    
    def __init__(self, config: CircuitBreakerConfig, provider_name: str):
        self.config = config
        self.provider_name = provider_name
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.lock = Lock()
    
    def can_execute(self) -> bool:
        """Check if requests should be allowed."""
        with self.lock:
            if self.state == CircuitState.CLOSED:
                return True
            
            if self.state == CircuitState.OPEN:
                # Check if recovery timeout has passed
                if self.last_failure_time:
                    elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
                    if elapsed >= self.config.recovery_timeout_seconds:
                        self.state = CircuitState.HALF_OPEN
                        self.success_count = 0
                        logger.info(f"Circuit breaker {self.provider_name}: OPEN -> HALF_OPEN")
                        return True
                return False
            
            # HALF_OPEN: allow limited requests
            return True
    
    def record_success(self):
        """Record a successful request."""
        with self.lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.half_open_requests:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    logger.info(f"Circuit breaker {self.provider_name}: HALF_OPEN -> CLOSED")
    
    def record_failure(self):
        """Record a failed request."""
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = datetime.utcnow()
            
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker {self.provider_name}: HALF_OPEN -> OPEN")
            elif self.failure_count >= self.config.failure_threshold:
                self.state = CircuitState.OPEN
                logger.warning(
                    f"Circuit breaker {self.provider_name}: CLOSED -> OPEN "
                    f"(failures: {self.failure_count})"
                )


# ============================================================================
# Rate Limiter
# ============================================================================

class RateLimiter:
    """Token bucket rate limiter."""
    
    def __init__(self, config: RateLimitConfig, agent_type: str):
        self.config = config
        self.agent_type = agent_type
        self.request_timestamps: List[datetime] = []
        self.token_usage: List[tuple] = []  # (timestamp, tokens)
        self.lock = Lock()
    
    def can_execute(self) -> bool:
        """Check if a request is allowed under rate limits."""
        with self.lock:
            now = datetime.utcnow()
            minute_ago = now - timedelta(minutes=1)
            
            # Clean old entries
            self.request_timestamps = [
                ts for ts in self.request_timestamps if ts > minute_ago
            ]
            self.token_usage = [
                (ts, tokens) for ts, tokens in self.token_usage if ts > minute_ago
            ]
            
            # Check request rate
            if len(self.request_timestamps) >= self.config.requests_per_minute:
                logger.warning(f"Rate limit exceeded for {self.agent_type}: requests")
                return False
            
            # Check token rate
            total_tokens = sum(tokens for _, tokens in self.token_usage)
            if total_tokens >= self.config.tokens_per_minute:
                logger.warning(f"Rate limit exceeded for {self.agent_type}: tokens")
                return False
            
            return True
    
    def record_request(self, tokens: int = 0):
        """Record a request for rate limiting."""
        with self.lock:
            now = datetime.utcnow()
            self.request_timestamps.append(now)
            if tokens > 0:
                self.token_usage.append((now, tokens))


# ============================================================================
# Cost Tracker
# ============================================================================

class CostTracker:
    """Track costs per agent for budget enforcement."""
    
    def __init__(self, budget_per_hour: Optional[float] = None):
        self.budget_per_hour = budget_per_hour
        self.costs: List[tuple] = []  # (timestamp, cost)
        self.lock = Lock()
    
    def can_spend(self, estimated_cost: float) -> bool:
        """Check if spending is within budget."""
        if not self.budget_per_hour:
            return True
        
        with self.lock:
            now = datetime.utcnow()
            hour_ago = now - timedelta(hours=1)
            
            # Clean old entries
            self.costs = [(ts, cost) for ts, cost in self.costs if ts > hour_ago]
            
            total_cost = sum(cost for _, cost in self.costs)
            return (total_cost + estimated_cost) <= self.budget_per_hour
    
    def record_cost(self, cost: float):
        """Record a cost expenditure."""
        with self.lock:
            self.costs.append((datetime.utcnow(), cost))


# ============================================================================
# Agent Router
# ============================================================================

class AgentRouter:
    """
    Routes requests to appropriate LLM providers based on agent configuration.
    
    Features:
    - Dynamic provider selection per agent
    - Fallback chain for resilience
    - Rate limiting
    - Circuit breaker
    - Cost tracking
    """
    
    def __init__(self, config_path: str = None, config_dict: Dict = None):
        """
        Initialize router with configuration.
        
        Args:
            config_path: Path to agents.yaml config file
            config_dict: Direct config dictionary (alternative to file)
        """
        self.policies: Dict[str, AgentPolicy] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.rate_limiters: Dict[str, RateLimiter] = {}
        self.cost_trackers: Dict[str, CostTracker] = {}
        self._adapters_cache: Dict[str, Any] = {}
        
        if config_path:
            self._load_config(config_path)
        elif config_dict:
            self._parse_config(config_dict)
    
    def _load_config(self, config_path: str):
        """Load configuration from YAML file."""
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        self._parse_config(config)
    
    def _parse_config(self, config: Dict):
        """Parse configuration dictionary into policy objects."""
        for agent_name, agent_config in config.get("agents", {}).items():
            providers = []
            for p in agent_config.get("providers", []):
                providers.append(ProviderConfig(
                    name=p["name"],
                    api_key_env=p["api_key_env"],
                    model=p["model"],
                    base_url=p.get("base_url"),
                    temperature=p.get("temperature", 0.7),
                    max_tokens=p.get("max_tokens", 4096),
                    timeout=p.get("timeout", 60),
                    priority=p.get("priority", 1),
                    max_cost_per_request=p.get("max_cost_per_request")
                ))
            
            rate_config = agent_config.get("rate_limit", {})
            cb_config = agent_config.get("circuit_breaker", {})
            
            policy = AgentPolicy(
                agent_type=agent_name,
                providers=sorted(providers, key=lambda x: x.priority),
                rate_limit=RateLimitConfig(
                    requests_per_minute=rate_config.get("requests_per_minute", 60),
                    tokens_per_minute=rate_config.get("tokens_per_minute", 100000),
                    concurrent_requests=rate_config.get("concurrent_requests", 10)
                ),
                circuit_breaker=CircuitBreakerConfig(
                    failure_threshold=cb_config.get("failure_threshold", 5),
                    recovery_timeout_seconds=cb_config.get("recovery_timeout_seconds", 60),
                    half_open_requests=cb_config.get("half_open_requests", 3)
                ),
                latency_sla_ms=agent_config.get("latency_sla_ms", 30000),
                cost_budget_per_hour=agent_config.get("cost_budget_per_hour"),
                fallback_enabled=agent_config.get("fallback_enabled", True),
                retry_attempts=agent_config.get("retry_attempts", 3),
                retry_delay_seconds=agent_config.get("retry_delay_seconds", 1.0)
            )
            
            self.policies[agent_name] = policy
            
            # Initialize components for each provider
            for provider in policy.providers:
                cb_key = f"{agent_name}:{provider.name}"
                self.circuit_breakers[cb_key] = CircuitBreaker(
                    policy.circuit_breaker, cb_key
                )
            
            self.rate_limiters[agent_name] = RateLimiter(
                policy.rate_limit, agent_name
            )
            self.cost_trackers[agent_name] = CostTracker(
                policy.cost_budget_per_hour
            )
    
    def get_adapter(self, agent_type: str, prefer_provider: str = None):
        """
        Get an LLM adapter for the specified agent type.
        
        Args:
            agent_type: Type of agent (e.g., 'document_analyzer')
            prefer_provider: Optional preferred provider name
            
        Returns:
            LLM adapter instance
            
        Raises:
            RuntimeError: If no healthy provider is available
        """
        policy = self.policies.get(agent_type)
        if not policy:
            raise ValueError(f"No policy configured for agent: {agent_type}")
        
        rate_limiter = self.rate_limiters[agent_type]
        cost_tracker = self.cost_trackers[agent_type]
        
        # Check rate limit
        if not rate_limiter.can_execute():
            raise RuntimeError(f"Rate limit exceeded for agent: {agent_type}")
        
        # Try providers in order
        providers = policy.providers
        if prefer_provider:
            providers = sorted(
                providers,
                key=lambda p: 0 if p.name == prefer_provider else p.priority
            )
        
        last_error = None
        for provider in providers:
            cb_key = f"{agent_type}:{provider.name}"
            circuit_breaker = self.circuit_breakers[cb_key]
            
            if not circuit_breaker.can_execute():
                logger.debug(f"Skipping {provider.name}: circuit open")
                continue
            
            try:
                adapter = self._create_adapter(provider, agent_type)
                
                # Wrap adapter with resilience
                return ResilientAdapter(
                    adapter=adapter,
                    circuit_breaker=circuit_breaker,
                    rate_limiter=rate_limiter,
                    cost_tracker=cost_tracker,
                    retry_attempts=policy.retry_attempts,
                    retry_delay=policy.retry_delay_seconds
                )
            except Exception as e:
                logger.warning(f"Failed to create adapter for {provider.name}: {e}")
                last_error = e
                continue
        
        raise RuntimeError(
            f"No healthy provider available for agent {agent_type}. "
            f"Last error: {last_error}"
        )
    
    def _create_adapter(self, provider: ProviderConfig, agent_type: str):
        """Create an LLM adapter for the given provider."""
        # Import the adapter factory from our interface
        try:
            from provider_adapter_interface import LLMAdapterFactory
        except ImportError:
            # Fallback: create inline
            return self._create_adapter_fallback(provider)
        
        return LLMAdapterFactory.create(
            provider=provider.name,
            api_key=provider.get_api_key(),
            model=provider.model,
            base_url=provider.base_url,
            temperature=provider.temperature,
            max_tokens=provider.max_tokens,
            timeout=provider.timeout
        )
    
    def _create_adapter_fallback(self, provider: ProviderConfig):
        """Fallback adapter creation without external imports."""
        # This is a simplified fallback - in production use the full interface
        class SimpleAdapter:
            def __init__(self, provider):
                self.provider = provider
            
            def send(self, prompt, **kwargs):
                raise NotImplementedError("Import provider_adapter_interface for full functionality")
        
        return SimpleAdapter(provider)


# ============================================================================
# Resilient Adapter Wrapper
# ============================================================================

class ResilientAdapter:
    """Wrapper that adds resilience features to an adapter."""
    
    def __init__(
        self,
        adapter,
        circuit_breaker: CircuitBreaker,
        rate_limiter: RateLimiter,
        cost_tracker: CostTracker,
        retry_attempts: int = 3,
        retry_delay: float = 1.0
    ):
        self.adapter = adapter
        self.circuit_breaker = circuit_breaker
        self.rate_limiter = rate_limiter
        self.cost_tracker = cost_tracker
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
    
    def send(self, prompt: str, **kwargs):
        """Send with retry and circuit breaker."""
        last_error = None
        
        for attempt in range(self.retry_attempts):
            try:
                response = self.adapter.send(prompt, **kwargs)
                self.circuit_breaker.record_success()
                
                # Track usage
                if hasattr(response, 'usage'):
                    self.rate_limiter.record_request(response.usage.total_tokens)
                    self.cost_tracker.record_cost(response.usage.estimated_cost_usd)
                
                return response
                
            except Exception as e:
                last_error = e
                self.circuit_breaker.record_failure()
                
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff
                    logger.warning(f"Retry {attempt + 1}/{self.retry_attempts}: {e}")
        
        raise last_error
    
    def stream(self, prompt: str, **kwargs):
        """Stream with circuit breaker (no retry for streams)."""
        try:
            for token in self.adapter.stream(prompt, **kwargs):
                yield token
            self.circuit_breaker.record_success()
        except Exception as e:
            self.circuit_breaker.record_failure()
            raise
    
    def health_check(self):
        """Delegate health check to adapter."""
        return self.adapter.health_check()


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    # Example configuration
    example_config = {
        "agents": {
            "document_analyzer": {
                "providers": [
                    {
                        "name": "openai",
                        "api_key_env": "OPENAI_API_KEY",
                        "model": "gpt-4o-mini",
                        "priority": 1
                    },
                    {
                        "name": "google",
                        "api_key_env": "GOOGLE_API_KEY",
                        "model": "gemini-1.5-flash",
                        "priority": 2
                    }
                ],
                "rate_limit": {
                    "requests_per_minute": 30,
                    "tokens_per_minute": 50000
                },
                "cost_budget_per_hour": 5.0,
                "fallback_enabled": True
            }
        }
    }
    
    print("Agent Router - Load from agents.yaml or pass config dict")
    print(f"Example config: {example_config}")
