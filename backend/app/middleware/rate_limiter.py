"""
API Rate Limiting Middleware.

Prevents abuse by limiting request rates per user/IP.
"""
import time
import logging
from functools import wraps
from flask import request, jsonify, g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
import redis
from flask import current_app

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter using Redis."""
    
    # Rate limit presets (requests per minute)
    PRESETS = {
        'strict': (10, 60),     # 10 per minute
        'normal': (60, 60),     # 60 per minute
        'relaxed': (120, 60),   # 120 per minute
        'ai': (10, 60),         # AI endpoints: 10 per minute
        'export': (5, 60),      # Export: 5 per minute
    }
    
    def __init__(self):
        redis_url = current_app.config.get(
            'CELERY_BROKER_URL',
            'redis://localhost:6379/0'
        )
        try:
            self.redis = redis.from_url(redis_url)
            self.enabled = True
            self.redis.ping()
        except redis.ConnectionError:
            logger.warning('Redis not available, rate limiting disabled')
            self.redis = None
            self.enabled = False
    
    def is_allowed(
        self,
        key: str,
        max_requests: int = 60,
        window_seconds: int = 60
    ) -> tuple[bool, dict]:
        """
        Check if request is allowed under rate limit.
        
        Returns:
            Tuple of (is_allowed, rate_info)
        """
        if not self.enabled:
            return True, {'limit': max_requests, 'remaining': max_requests, 'reset': 0}
        
        now = int(time.time())
        window_start = now - window_seconds
        rate_key = f'ratelimit:{key}:{now // window_seconds}'
        
        try:
            # Get current count
            pipe = self.redis.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, window_seconds)
            results = pipe.execute()
            
            current_count = results[0]
            remaining = max(0, max_requests - current_count)
            reset_time = (now // window_seconds + 1) * window_seconds
            
            rate_info = {
                'limit': max_requests,
                'remaining': remaining,
                'reset': reset_time,
            }
            
            return current_count <= max_requests, rate_info
            
        except Exception as e:
            logger.error(f'Rate limit check error: {e}')
            return True, {'limit': max_requests, 'remaining': max_requests, 'reset': 0}
    
    def get_client_key(self) -> str:
        """Get rate limit key for current request."""
        # Try to use authenticated user ID
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                return f'user:{user_id}'
        except:
            pass
        
        # Fall back to IP address
        return f'ip:{request.remote_addr}'


# Singleton
_limiter_instance = None

def get_rate_limiter() -> RateLimiter:
    """Get rate limiter instance."""
    global _limiter_instance
    if _limiter_instance is None:
        _limiter_instance = RateLimiter()
    return _limiter_instance


def rate_limit(preset: str = 'normal'):
    """
    Decorator to apply rate limiting to a route.
    
    Usage:
        @app.route('/api/expensive')
        @rate_limit('strict')
        def expensive_endpoint():
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            limiter = get_rate_limiter()
            
            max_requests, window = RateLimiter.PRESETS.get(preset, (60, 60))
            client_key = limiter.get_client_key()
            
            is_allowed, rate_info = limiter.is_allowed(
                client_key, max_requests, window
            )
            
            # Set rate limit headers
            g.rate_limit_info = rate_info
            
            if not is_allowed:
                response = jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': rate_info['reset'] - int(time.time())
                })
                response.status_code = 429
                response.headers['X-RateLimit-Limit'] = str(rate_info['limit'])
                response.headers['X-RateLimit-Remaining'] = str(rate_info['remaining'])
                response.headers['X-RateLimit-Reset'] = str(rate_info['reset'])
                response.headers['Retry-After'] = str(rate_info['reset'] - int(time.time()))
                return response
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


def add_rate_limit_headers(response):
    """After-request handler to add rate limit headers."""
    if hasattr(g, 'rate_limit_info'):
        info = g.rate_limit_info
        response.headers['X-RateLimit-Limit'] = str(info['limit'])
        response.headers['X-RateLimit-Remaining'] = str(info['remaining'])
        response.headers['X-RateLimit-Reset'] = str(info['reset'])
    return response
