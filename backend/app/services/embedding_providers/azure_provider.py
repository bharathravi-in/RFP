"""
Azure OpenAI Embedding Provider

Uses Azure OpenAI Service for embeddings.
"""
from openai import AzureOpenAI
from typing import List
import logging
from .base import EmbeddingProvider

logger = logging.getLogger(__name__)


class AzureEmbeddingProvider(EmbeddingProvider):
    """Azure OpenAI embedding provider."""
    
    def __init__(
        self,
        api_key: str,
        endpoint: str,
        model: str,
        api_version: str = "2024-02-01"
    ):
        """
        Initialize Azure OpenAI embedding provider.
        
        Args:
            api_key: Azure OpenAI API key
            endpoint: Azure endpoint URL
            model: Deployment name
            api_version: API version
        """
        self.client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version
        )
        self.model = model
        self._dimension = 1536  # Azure typically uses OpenAI models
        logger.info(f"Initialized Azure embedding provider with deployment: {model}")
    
    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using Azure OpenAI."""
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Azure embedding failed: {e}")
            raise
    
    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (batch processing)."""
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"Azure batch embedding failed: {e}")
            raise
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    @property
    def provider_name(self) -> str:
        return "azure"
