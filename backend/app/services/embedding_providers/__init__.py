"""
Embedding Providers Package

Provides abstraction for multiple embedding providers (Google AI, OpenAI, Azure, etc.)
"""
from .base import EmbeddingProvider
from .google_provider import GoogleEmbeddingProvider
from .openai_provider import OpenAIEmbeddingProvider
from .azure_provider import AzureEmbeddingProvider
from .factory import EmbeddingProviderFactory

__all__ = [
    'EmbeddingProvider',
    'GoogleEmbeddingProvider',
    'OpenAIEmbeddingProvider',
    'AzureEmbeddingProvider',
    'EmbeddingProviderFactory',
]
