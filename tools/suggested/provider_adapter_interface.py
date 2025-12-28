"""
Provider Adapter Interface for LLMs

A minimal, cloud-agnostic adapter interface for LLM providers with:
- Unified interface for send/stream/health/usage
- Cost estimation hooks
- Token usage telemetry
- Health check capabilities

Usage:
    from provider_adapter_interface import LLMAdapter, OpenAIAdapter, GoogleAdapter
    
    adapter = OpenAIAdapter(api_key="...", model="gpt-4")
    response = adapter.send("Hello world")
    stream = adapter.stream("Tell me a story")
    health = adapter.health_check()
    usage = adapter.get_usage()
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Iterator, Callable
from datetime import datetime
import logging
import time

logger = logging.getLogger(__name__)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class TokenUsage:
    """Token usage statistics for a single request."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "estimated_cost_usd": self.estimated_cost_usd,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class LLMResponse:
    """Standardized LLM response across all providers."""
    content: str
    usage: TokenUsage
    model: str
    provider: str
    latency_ms: float
    finish_reason: Optional[str] = None
    raw_response: Optional[Dict] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "usage": self.usage.to_dict(),
            "model": self.model,
            "provider": self.provider,
            "latency_ms": self.latency_ms,
            "finish_reason": self.finish_reason
        }


@dataclass
class HealthStatus:
    """Health check result for a provider."""
    healthy: bool
    provider: str
    latency_ms: float
    message: str
    model: Optional[str] = None
    last_check: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "healthy": self.healthy,
            "provider": self.provider,
            "latency_ms": self.latency_ms,
            "message": self.message,
            "model": self.model,
            "last_check": self.last_check.isoformat()
        }


# ============================================================================
# Cost Estimation
# ============================================================================

# Cost per 1K tokens (as of 2024, update as needed)
COST_PER_1K_TOKENS = {
    # OpenAI
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    
    # Google
    "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
    "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003},
    "gemini-flash": {"input": 0.000075, "output": 0.0003},
    "gemini-pro": {"input": 0.00125, "output": 0.005},
    
    # Azure (same as OpenAI for same models)
    "azure-gpt-4": {"input": 0.03, "output": 0.06},
    
    # Anthropic
    "claude-3-opus": {"input": 0.015, "output": 0.075},
    "claude-3-sonnet": {"input": 0.003, "output": 0.015},
    "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    
    # Default fallback
    "default": {"input": 0.001, "output": 0.002}
}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate cost in USD for a given model and token count."""
    pricing = COST_PER_1K_TOKENS.get(model, COST_PER_1K_TOKENS["default"])
    input_cost = (prompt_tokens / 1000) * pricing["input"]
    output_cost = (completion_tokens / 1000) * pricing["output"]
    return round(input_cost + output_cost, 6)


# ============================================================================
# Abstract Base Adapter
# ============================================================================

class LLMAdapter(ABC):
    """
    Abstract base class for LLM provider adapters.
    
    Implementations must provide:
    - send(): Synchronous text generation
    - stream(): Streaming text generation
    - health_check(): Provider health verification
    - get_usage(): Accumulated usage statistics
    """
    
    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        timeout: int = 60,
        **kwargs
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.extra_config = kwargs
        
        # Usage tracking
        self._total_usage = TokenUsage()
        self._request_count = 0
        self._error_count = 0
        
        # Telemetry callback
        self._telemetry_callback: Optional[Callable[[TokenUsage], None]] = None
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider identifier."""
        pass
    
    @abstractmethod
    def send(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Send a prompt and get a complete response.
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system instructions
            **kwargs: Provider-specific parameters
            
        Returns:
            LLMResponse with content and usage
        """
        pass
    
    @abstractmethod
    def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Iterator[str]:
        """
        Stream a response token by token.
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system instructions
            **kwargs: Provider-specific parameters
            
        Yields:
            String tokens as they are generated
        """
        pass
    
    def health_check(self) -> HealthStatus:
        """
        Check provider health with a small test request.
        
        Returns:
            HealthStatus with connectivity info
        """
        start = time.time()
        try:
            response = self.send("Say 'ok'", max_tokens=5)
            latency = (time.time() - start) * 1000
            return HealthStatus(
                healthy=True,
                provider=self.provider_name,
                latency_ms=round(latency, 2),
                message="Connected successfully",
                model=self.model
            )
        except Exception as e:
            latency = (time.time() - start) * 1000
            return HealthStatus(
                healthy=False,
                provider=self.provider_name,
                latency_ms=round(latency, 2),
                message=f"Health check failed: {str(e)}",
                model=self.model
            )
    
    def get_usage(self) -> Dict[str, Any]:
        """Get accumulated usage statistics."""
        return {
            "provider": self.provider_name,
            "model": self.model,
            "request_count": self._request_count,
            "error_count": self._error_count,
            "total_tokens": self._total_usage.total_tokens,
            "prompt_tokens": self._total_usage.prompt_tokens,
            "completion_tokens": self._total_usage.completion_tokens,
            "estimated_cost_usd": self._total_usage.estimated_cost_usd
        }
    
    def set_telemetry_callback(self, callback: Callable[[TokenUsage], None]):
        """Set a callback for usage telemetry (e.g., for OpenTelemetry)."""
        self._telemetry_callback = callback
    
    def _track_usage(self, usage: TokenUsage):
        """Track usage internally and trigger telemetry callback."""
        self._request_count += 1
        self._total_usage.prompt_tokens += usage.prompt_tokens
        self._total_usage.completion_tokens += usage.completion_tokens
        self._total_usage.total_tokens += usage.total_tokens
        self._total_usage.estimated_cost_usd += usage.estimated_cost_usd
        
        if self._telemetry_callback:
            self._telemetry_callback(usage)
    
    def _track_error(self):
        """Track errors for observability."""
        self._error_count += 1


# ============================================================================
# OpenAI Adapter Implementation
# ============================================================================

class OpenAIAdapter(LLMAdapter):
    """
    OpenAI-compatible adapter (works with OpenAI, Azure OpenAI, LiteLLM proxy).
    """
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._client = None
    
    @property
    def provider_name(self) -> str:
        return "openai"
    
    @property
    def client(self):
        if self._client is None:
            try:
                from openai import OpenAI
                client_kwargs = {"api_key": self.api_key}
                if self.base_url:
                    client_kwargs["base_url"] = self.base_url
                self._client = OpenAI(**client_kwargs)
            except ImportError:
                raise ImportError("openai package required: pip install openai")
        return self._client
    
    def send(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        start = time.time()
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens)
            )
            
            latency = (time.time() - start) * 1000
            
            usage = TokenUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens,
                estimated_cost_usd=estimate_cost(
                    self.model,
                    response.usage.prompt_tokens,
                    response.usage.completion_tokens
                )
            )
            self._track_usage(usage)
            
            return LLMResponse(
                content=response.choices[0].message.content,
                usage=usage,
                model=self.model,
                provider=self.provider_name,
                latency_ms=round(latency, 2),
                finish_reason=response.choices[0].finish_reason
            )
        except Exception as e:
            self._track_error()
            raise
    
    def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Iterator[str]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens),
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            self._track_error()
            raise


# ============================================================================
# Google AI Adapter Implementation
# ============================================================================

class GoogleAdapter(LLMAdapter):
    """
    Google AI (Gemini) adapter using google-generativeai SDK.
    """
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._model_instance = None
    
    @property
    def provider_name(self) -> str:
        return "google"
    
    @property
    def model_instance(self):
        if self._model_instance is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._model_instance = genai.GenerativeModel(self.model)
            except ImportError:
                raise ImportError("google-generativeai required: pip install google-generativeai")
        return self._model_instance
    
    def send(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        start = time.time()
        try:
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"
            
            response = self.model_instance.generate_content(
                full_prompt,
                generation_config={
                    "temperature": kwargs.get("temperature", self.temperature),
                    "max_output_tokens": kwargs.get("max_tokens", self.max_tokens)
                }
            )
            
            latency = (time.time() - start) * 1000
            
            # Estimate tokens (Google doesn't always return exact counts)
            prompt_tokens = len(full_prompt) // 4  # Rough estimate
            completion_tokens = len(response.text) // 4
            
            usage = TokenUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                estimated_cost_usd=estimate_cost(
                    self.model, prompt_tokens, completion_tokens
                )
            )
            self._track_usage(usage)
            
            return LLMResponse(
                content=response.text,
                usage=usage,
                model=self.model,
                provider=self.provider_name,
                latency_ms=round(latency, 2),
                finish_reason="stop"
            )
        except Exception as e:
            self._track_error()
            raise
    
    def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Iterator[str]:
        try:
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"
            
            response = self.model_instance.generate_content(
                full_prompt,
                generation_config={
                    "temperature": kwargs.get("temperature", self.temperature),
                    "max_output_tokens": kwargs.get("max_tokens", self.max_tokens)
                },
                stream=True
            )
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            self._track_error()
            raise


# ============================================================================
# Adapter Factory
# ============================================================================

class LLMAdapterFactory:
    """Factory for creating LLM adapters by provider name."""
    
    _adapters = {
        "openai": OpenAIAdapter,
        "google": GoogleAdapter,
        # Add more adapters here as needed
    }
    
    @classmethod
    def register(cls, name: str, adapter_class: type):
        """Register a custom adapter."""
        cls._adapters[name] = adapter_class
    
    @classmethod
    def create(
        cls,
        provider: str,
        api_key: str,
        model: str,
        **kwargs
    ) -> LLMAdapter:
        """
        Create an adapter instance.
        
        Args:
            provider: Provider name (openai, google, etc.)
            api_key: API key for authentication
            model: Model name to use
            **kwargs: Additional config (base_url, temperature, etc.)
        """
        adapter_class = cls._adapters.get(provider.lower())
        if not adapter_class:
            raise ValueError(
                f"Unknown provider: {provider}. "
                f"Available: {list(cls._adapters.keys())}"
            )
        return adapter_class(api_key=api_key, model=model, **kwargs)
    
    @classmethod
    def list_providers(cls) -> List[str]:
        """List available provider names."""
        return list(cls._adapters.keys())


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    # Example: Create and use an OpenAI adapter
    # adapter = LLMAdapterFactory.create(
    #     provider="openai",
    #     api_key="sk-...",
    #     model="gpt-4o-mini"
    # )
    # 
    # # Send a prompt
    # response = adapter.send("Hello, how are you?")
    # print(f"Response: {response.content}")
    # print(f"Usage: {response.usage.to_dict()}")
    # 
    # # Stream a response
    # for token in adapter.stream("Tell me a short story"):
    #     print(token, end="", flush=True)
    # 
    # # Check health
    # health = adapter.health_check()
    # print(f"\nHealth: {health.to_dict()}")
    # 
    # # Get accumulated usage
    # print(f"Total usage: {adapter.get_usage()}")
    
    print("Provider Adapter Interface - See docstring for usage examples")
