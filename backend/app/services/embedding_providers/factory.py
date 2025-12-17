"""
Embedding Provider Factory

Creates embedding provider instances based on configuration.
"""
from typing import Optional
import logging
from .base import EmbeddingProvider
from .google_provider import GoogleEmbeddingProvider
from .openai_provider import OpenAIEmbeddingProvider
from .azure_provider import AzureEmbeddingProvider

logger = logging.getLogger(__name__)


class EmbeddingProviderFactory:
    """Factory to create embedding providers based on configuration."""
    
    @staticmethod
    def create(
        provider: str,
        api_key: str,
        model: Optional[str] = None,
        endpoint: Optional[str] = None,
        **kwargs
    ) -> EmbeddingProvider:
        """
        Create an embedding provider instance.
        
        Args:
            provider: Provider name (google, openai, azure)
            api_key: API key for the provider
            model: Model name (optional, uses provider default if not specified)
            endpoint: API endpoint (required for Azure)
            **kwargs: Additional provider-specific arguments
            
        Returns:
            EmbeddingProvider instance
            
        Raises:
            ValueError: If provider is not supported or required args are missing
        """
        provider = provider.lower()
        
        if provider == 'google':
            return GoogleEmbeddingProvider(
                api_key=api_key,
                model=model or "models/text-embedding-004"
            )
        
        elif provider == 'openai':
            return OpenAIEmbeddingProvider(
                api_key=api_key,
                model=model or "text-embedding-3-small"
            )
        
        elif provider == 'azure':
            if not endpoint:
                raise ValueError("Azure provider requires 'endpoint' parameter")
            if not model:
                raise ValueError("Azure provider requires 'model' (deployment name)")
            
            return AzureEmbeddingProvider(
                api_key=api_key,
                endpoint=endpoint,
                model=model,
                api_version=kwargs.get('api_version', '2024-02-01')
            )
        
        else:
            raise ValueError(
                f"Unsupported embedding provider: {provider}. "
                f"Supported providers: google, openai, azure"
            )
    
    @staticmethod
    def get_supported_providers():
        """Get list of supported provider names."""
        return ['google', 'openai', 'azure']
