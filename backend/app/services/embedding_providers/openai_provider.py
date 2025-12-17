"""
OpenAI Embedding Provider

Uses OpenAI's embedding API.
"""
from openai import OpenAI
from typing import List
import logging
from .base import EmbeddingProvider

logger = logging.getLogger(__name__)


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider."""
    
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        """
        Initialize OpenAI embedding provider.
        
        Args:
            api_key: OpenAI API key
            model: Model name (default: text-embedding-3-small)
        """
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self._dimension = self._get_dimension_for_model(model)
        logger.info(f"Initialized OpenAI embedding provider with model: {model}")
    
    def _get_dimension_for_model(self, model: str) -> int:
        """Get embedding dimension based on model name."""
        if "3-large" in model:
            return 3072
        elif "3-small" in model:
            return 1536
        elif "ada-002" in model:
            return 1536
        return 1536  # Default
    
    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using OpenAI."""
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}")
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
            logger.error(f"OpenAI batch embedding failed: {e}")
            raise
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    @property
    def provider_name(self) -> str:
        return "openai"
