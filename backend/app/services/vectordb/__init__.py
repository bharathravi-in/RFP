"""
Vector Database Module

Provides cloud-agnostic vector database abstraction supporting:
- Qdrant (default)
- Pinecone
- PostgreSQL pgvector

Usage:
    from app.services.vectordb import get_vector_adapter
    
    adapter = get_vector_adapter()  # Uses VECTOR_DB_PROVIDER env var
    results = adapter.query("collection", query_vector, top_k=10)
"""
import os
import logging
from typing import Optional

from .adapter import (
    VectorDBAdapter,
    VectorDBFactory,
    VectorRecord,
    SearchResult,
    CollectionInfo,
    QdrantAdapter,
    PineconeAdapter,
    PGVectorAdapter,
)

logger = logging.getLogger(__name__)

# Default provider from environment
DEFAULT_PROVIDER = os.environ.get("VECTOR_DB_PROVIDER", "qdrant")

# Singleton adapter cache
_adapter_cache = {}


def get_vector_adapter(
    provider: str = None,
    **kwargs
) -> VectorDBAdapter:
    """
    Get a vector database adapter instance.
    
    Uses environment variables for configuration:
    - VECTOR_DB_PROVIDER: qdrant, pinecone, pgvector (default: qdrant)
    - QDRANT_URL, QDRANT_API_KEY: Qdrant config
    - PINECONE_API_KEY, PINECONE_ENVIRONMENT: Pinecone config
    - DATABASE_URL: pgvector config (uses existing Postgres)
    
    Args:
        provider: Provider name (defaults to VECTOR_DB_PROVIDER env var)
        **kwargs: Provider-specific configuration
        
    Returns:
        VectorDBAdapter instance
    """
    provider = provider or DEFAULT_PROVIDER
    cache_key = f"{provider}:{hash(frozenset(kwargs.items()) if kwargs else '')}"
    
    if cache_key not in _adapter_cache:
        try:
            # Add environment config based on provider
            if provider == "qdrant" and not kwargs:
                kwargs = {
                    "url": os.environ.get("QDRANT_URL") or os.environ.get("QDRANT_HOST", "http://localhost:6333"),
                    "api_key": os.environ.get("QDRANT_API_KEY"),
                }
            elif provider == "pinecone" and not kwargs:
                kwargs = {
                    "api_key": os.environ.get("PINECONE_API_KEY"),
                    "environment": os.environ.get("PINECONE_ENVIRONMENT"),
                }
            elif provider == "pgvector" and not kwargs:
                kwargs = {
                    "connection_string": os.environ.get("DATABASE_URL"),
                }
            
            adapter = VectorDBFactory.create(provider, **kwargs)
            _adapter_cache[cache_key] = adapter
            logger.info(f"Created {provider} vector adapter")
            
        except Exception as e:
            logger.error(f"Failed to create {provider} adapter: {e}")
            raise
    
    return _adapter_cache[cache_key]


def get_adapter_health() -> dict:
    """Check health of the default vector adapter."""
    try:
        adapter = get_vector_adapter()
        return adapter.health()
    except Exception as e:
        return {
            "healthy": False,
            "provider": DEFAULT_PROVIDER,
            "message": f"Adapter initialization failed: {str(e)}"
        }


__all__ = [
    "get_vector_adapter",
    "get_adapter_health",
    "VectorDBAdapter",
    "VectorDBFactory",
    "VectorRecord",
    "SearchResult",
    "CollectionInfo",
    "QdrantAdapter",
    "PineconeAdapter",
    "PGVectorAdapter",
]
