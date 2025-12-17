"""
Google AI Embedding Provider

Uses Google's Generative AI API for embeddings.
"""
import google.generativeai as genai
from typing import List
import logging
from .base import EmbeddingProvider

logger = logging.getLogger(__name__)


class GoogleEmbeddingProvider(EmbeddingProvider):
    """Google AI embedding provider using text-embedding-004 model."""
    
    def __init__(self, api_key: str, model: str = "models/text-embedding-004"):
        """
        Initialize Google embedding provider.
        
        Args:
            api_key: Google AI API key
            model: Model name (default: text-embedding-004)
        """
        self.api_key = api_key
        self.model = model
        genai.configure(api_key=api_key)
        logger.info(f"Initialized Google embedding provider with model: {model}")
    
    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using Google AI."""
        try:
            result = genai.embed_content(
                model=self.model,
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            logger.error(f"Google embedding failed: {e}")
            raise
    
    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        # Google AI doesn't have native batch support, so we process one by one
        return [self.get_embedding(text) for text in texts]
    
    @property
    def dimension(self) -> int:
        """Google text-embedding-004 produces 768-dimensional embeddings."""
        return 768
    
    @property
    def provider_name(self) -> str:
        return "google"
