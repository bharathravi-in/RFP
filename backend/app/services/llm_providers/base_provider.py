"""
Base LLM Provider Classes

Defines the interface and factory for LLM providers.
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        timeout_seconds: float = 60.0,
        **kwargs
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout_seconds = timeout_seconds
        self.extra_config = kwargs
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name."""
        pass
    
    @abstractmethod
    def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate content from a prompt.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        pass
    
    @abstractmethod
    def generate_chat(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        """
        Generate content from chat messages.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        pass
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the provider connection.
        
        Returns:
            Dict with 'success', 'message', and optionally 'model'
        """
        try:
            result = self.generate_content("Say 'connection test successful' in 5 words or less.")
            return {
                'success': True,
                'message': f'Connected to {self.provider_name}',
                'model': self.model,
                'sample_response': result[:100]
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}',
                'model': self.model
            }


class LLMProviderFactory:
    """Factory for creating LLM provider instances."""
    
    _providers = {}
    
    @classmethod
    def register(cls, name: str, provider_class: type):
        """Register a provider class."""
        cls._providers[name] = provider_class
    
    @classmethod
    def create(
        cls,
        provider: str,
        api_key: str,
        model: str,
        base_url: Optional[str] = None,
        **kwargs
    ) -> BaseLLMProvider:
        """
        Create an LLM provider instance.
        
        Args:
            provider: Provider name ('litellm', 'google', 'openai')
            api_key: API key for authentication
            model: Model name to use
            base_url: Optional base URL for proxy
            **kwargs: Additional provider-specific config
            
        Returns:
            BaseLLMProvider instance
            
        Raises:
            ValueError: If provider is not supported
        """
        # Lazy import to avoid circular dependencies
        if not cls._providers:
            cls._register_default_providers()
        
        provider_class = cls._providers.get(provider.lower())
        if not provider_class:
            raise ValueError(
                f"Unknown provider: {provider}. "
                f"Supported: {list(cls._providers.keys())}"
            )
        
        return provider_class(
            api_key=api_key,
            model=model,
            base_url=base_url,
            **kwargs
        )
    
    @classmethod
    def _register_default_providers(cls):
        """Register built-in providers."""
        from .litellm_provider import LiteLLMProvider
        from .google_provider import GoogleAIProvider
        from .openai_provider import OpenAIProvider
        from .azure_provider import AzureOpenAIProvider
        
        cls.register('litellm', LiteLLMProvider)
        cls.register('google', GoogleAIProvider)
        cls.register('openai', OpenAIProvider)
        cls.register('azure', AzureOpenAIProvider)
    
    @classmethod
    def list_providers(cls) -> List[str]:
        """List available provider names."""
        if not cls._providers:
            cls._register_default_providers()
        return list(cls._providers.keys())
