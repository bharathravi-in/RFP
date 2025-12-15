"""
Redis Cache Service.

Provides caching for frequently accessed data to improve performance.
"""
import json
import logging
from typing import Any, Optional, Callable
from functools import wraps
import redis
from flask import current_app

logger = logging.getLogger(__name__)


class CacheService:
    """Redis-based caching service."""
    
    # Cache TTL presets (in seconds)
    TTL_SHORT = 60          # 1 minute
    TTL_MEDIUM = 300        # 5 minutes
    TTL_LONG = 3600         # 1 hour
    TTL_VERY_LONG = 86400   # 1 day
    
    def __init__(self):
        redis_url = current_app.config.get(
            'CELERY_BROKER_URL',
            'redis://localhost:6379/0'
        )
        try:
            self.redis = redis.from_url(redis_url)
            self.enabled = True
            # Test connection
            self.redis.ping()
        except redis.ConnectionError:
            logger.warning('Redis not available, caching disabled')
            self.redis = None
            self.enabled = False
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.enabled:
            return None
        
        try:
            data = self.redis.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f'Cache get error: {e}')
        return None
    
    def set(self, key: str, value: Any, ttl: int = TTL_MEDIUM) -> bool:
        """Set value in cache with TTL."""
        if not self.enabled:
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            self.redis.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error(f'Cache set error: {e}')
            return False
    
    def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        if not self.enabled:
            return False
        
        try:
            self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f'Cache delete error: {e}')
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        if not self.enabled:
            return 0
        
        try:
            keys = self.redis.keys(pattern)
            if keys:
                return self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f'Cache delete pattern error: {e}')
            return 0
    
    def invalidate_project(self, project_id: int):
        """Invalidate all cache entries for a project."""
        self.delete_pattern(f'project:{project_id}:*')
    
    def invalidate_user(self, user_id: int):
        """Invalidate all cache entries for a user."""
        self.delete_pattern(f'user:{user_id}:*')


# Cache key builders
def project_questions_key(project_id: int) -> str:
    return f'project:{project_id}:questions'

def project_answers_key(project_id: int) -> str:
    return f'project:{project_id}:answers'

def knowledge_search_key(org_id: int, query: str) -> str:
    return f'org:{org_id}:knowledge:search:{hash(query)}'

def dashboard_stats_key(org_id: int) -> str:
    return f'org:{org_id}:dashboard'


# Decorator for caching function results
def cached(key_func: Callable, ttl: int = CacheService.TTL_MEDIUM):
    """Decorator to cache function results."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = get_cache_service()
            if not cache.enabled:
                return func(*args, **kwargs)
            
            cache_key = key_func(*args, **kwargs)
            
            # Try to get from cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator


# Singleton getter
_cache_instance = None

def get_cache_service() -> CacheService:
    """Get cache service instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheService()
    return _cache_instance
