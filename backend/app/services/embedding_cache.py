"""
Redis Embedding Cache

Caches embeddings in Redis to reduce API calls and costs.
"""
import os
import json
import hashlib
import logging
from typing import List, Optional
from functools import wraps

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.environ.get('REDIS_URL', os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0'))
CACHE_TTL = int(os.environ.get('EMBEDDING_CACHE_TTL', 86400))  # 24 hours default
CACHE_ENABLED = os.environ.get('EMBEDDING_CACHE_ENABLED', 'true').lower() == 'true'

_redis_client = None
_cache_stats = {'hits': 0, 'misses': 0}


def _get_redis():
    """Get Redis client (lazy initialization)."""
    global _redis_client
    if _redis_client is None:
        try:
            import redis
            _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            # Test connection
            _redis_client.ping()
            logger.info(f"Embedding cache connected to Redis")
        except Exception as e:
            logger.warning(f"Redis not available for embedding cache: {e}")
            _redis_client = False  # Mark as unavailable
    return _redis_client if _redis_client else None


def _get_cache_key(text: str, provider: str = '', model: str = '') -> str:
    """Generate cache key from text and provider info."""
    content = f"{provider}:{model}:{text}"
    return f"embed:{hashlib.sha256(content.encode()).hexdigest()}"


def get_cached_embedding(text: str, provider: str = '', model: str = '') -> Optional[List[float]]:
    """
    Get embedding from cache if available.
    
    Args:
        text: The text to get embedding for
        provider: Embedding provider name
        model: Embedding model name
        
    Returns:
        Cached embedding vector or None if not cached
    """
    if not CACHE_ENABLED:
        return None
    
    redis_client = _get_redis()
    if not redis_client:
        return None
    
    try:
        cache_key = _get_cache_key(text, provider, model)
        cached = redis_client.get(cache_key)
        
        if cached:
            _cache_stats['hits'] += 1
            return json.loads(cached)
        
        _cache_stats['misses'] += 1
        return None
        
    except Exception as e:
        logger.warning(f"Cache read error: {e}")
        return None


def set_cached_embedding(
    text: str, 
    embedding: List[float], 
    provider: str = '', 
    model: str = '',
    ttl: int = None
) -> bool:
    """
    Store embedding in cache.
    
    Args:
        text: The original text
        embedding: The embedding vector
        provider: Embedding provider name
        model: Embedding model name
        ttl: Cache TTL in seconds (default: CACHE_TTL)
        
    Returns:
        True if cached successfully
    """
    if not CACHE_ENABLED:
        return False
    
    redis_client = _get_redis()
    if not redis_client:
        return False
    
    try:
        cache_key = _get_cache_key(text, provider, model)
        redis_client.setex(
            cache_key, 
            ttl or CACHE_TTL, 
            json.dumps(embedding)
        )
        return True
        
    except Exception as e:
        logger.warning(f"Cache write error: {e}")
        return False


def cached_embedding(provider: str = '', model: str = ''):
    """
    Decorator to add caching to embedding functions.
    
    Usage:
        @cached_embedding(provider='openai', model='text-embedding-3-small')
        def get_embedding(text: str) -> List[float]:
            return openai.embeddings.create(...)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(text: str, *args, **kwargs):
            # Check cache first
            cached = get_cached_embedding(text, provider, model)
            if cached is not None:
                return cached
            
            # Generate embedding
            embedding = func(text, *args, **kwargs)
            
            # Store in cache
            if embedding:
                set_cached_embedding(text, embedding, provider, model)
            
            return embedding
        return wrapper
    return decorator


def get_cache_stats() -> dict:
    """Get cache statistics."""
    total = _cache_stats['hits'] + _cache_stats['misses']
    hit_rate = (_cache_stats['hits'] / total * 100) if total > 0 else 0
    
    return {
        'enabled': CACHE_ENABLED,
        'hits': _cache_stats['hits'],
        'misses': _cache_stats['misses'],
        'hit_rate': f"{hit_rate:.1f}%",
        'ttl_seconds': CACHE_TTL
    }


def clear_cache(pattern: str = 'embed:*') -> int:
    """Clear cached embeddings matching pattern."""
    redis_client = _get_redis()
    if not redis_client:
        return 0
    
    try:
        keys = redis_client.keys(pattern)
        if keys:
            return redis_client.delete(*keys)
        return 0
    except Exception as e:
        logger.error(f"Cache clear error: {e}")
        return 0
