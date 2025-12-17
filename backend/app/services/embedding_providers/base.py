"""
Base Embedding Provider

Abstract base class for all embedding providers.
"""
from abc import ABC, abstractmethod
from typing import List


class EmbeddingProvider(ABC):
    """Base class for embedding providers."""
    
    @abstractmethod
    def get_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
            
        Returns:
            List of floats representing the embedding vector
        """
        pass
    
    @abstractmethod
    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors
        """
        pass
    
    @property
    @abstractmethod
    def dimension(self) -> int:
        """Get the dimension of embeddings produced by this provider."""
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Get the name of this provider."""
        pass
