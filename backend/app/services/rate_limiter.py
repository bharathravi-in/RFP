"""
Rate Limiting Middleware for per-tenant API throttling.

This middleware implements rate limiting per organization to prevent abuse
and ensure fair usage across tenants.
"""
from functools import wraps
from flask import request, jsonify, g
from flask_jwt_extended import get_jwt_identity
from datetime import datetime, timedelta
import redis
import os
from ..models import User


class RateLimiter:
    """
    Redis-based rate limiter for per-tenant API throttling.
    
    Default limits:
    - 1000 requests per minute per organization
    - Configurable per organization via OrganizationAIConfig
    """
    
    def __init__(self):
        redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
        try:
            self.redis = redis.from_url(redis_url)
            self.enabled = True
        except Exception as e:
            print(f"[RateLimiter] Redis not available: {e}")
            self.redis = None
            self.enabled = False
    
    def get_limit_key(self, org_id: int, endpoint: str = 'global') -> str:
        """Generate Redis key for rate limiting."""
        minute = datetime.utcnow().strftime('%Y%m%d%H%M')
        return f"ratelimit:{org_id}:{endpoint}:{minute}"
    
    def is_rate_limited(self, org_id: int, limit: int = 1000, endpoint: str = 'global') -> tuple:
        """
        Check if organization has exceeded rate limit.
        
        Returns:
            (is_limited: bool, current_count: int, limit: int, reset_seconds: int)
        """
        if not self.enabled or not self.redis:
            return (False, 0, limit, 60)
        
        key = self.get_limit_key(org_id, endpoint)
        
        try:
            # Increment counter
            pipe = self.redis.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            results = pipe.execute()
            
            current_count = results[0]
            ttl = results[1]
            
            # Set expiry if this is a new key
            if ttl == -1:
                self.redis.expire(key, 60)  # 1 minute window
                ttl = 60
            
            is_limited = current_count > limit
            
            return (is_limited, current_count, limit, max(ttl, 0))
        except Exception as e:
            print(f"[RateLimiter] Error checking limit: {e}")
            return (False, 0, limit, 60)
    
    def get_usage_stats(self, org_id: int) -> dict:
        """Get current usage statistics for an organization."""
        if not self.enabled or not self.redis:
            return {'enabled': False}
        
        minute = datetime.utcnow().strftime('%Y%m%d%H%M')
        key = f"ratelimit:{org_id}:global:{minute}"
        
        try:
            current = self.redis.get(key)
            return {
                'enabled': True,
                'current_minute_requests': int(current) if current else 0,
                'limit_per_minute': 1000,
                'window_reset_seconds': self.redis.ttl(key) or 60
            }
        except Exception:
            return {'enabled': False}


# Global rate limiter instance
rate_limiter = RateLimiter()


def rate_limit(limit: int = 1000, endpoint: str = None):
    """
    Decorator to apply rate limiting to API endpoints.
    
    Args:
        limit: Maximum requests per minute
        endpoint: Optional endpoint name for granular limits
    
    Usage:
        @bp.route('/generate')
        @jwt_required()
        @rate_limit(limit=100, endpoint='ai_generate')
        def generate():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Get organization from JWT
            try:
                user_id = get_jwt_identity()
                if user_id:
                    user = User.query.get(int(user_id))
                    if user and user.organization_id:
                        ep = endpoint or fn.__name__
                        is_limited, current, max_limit, reset = rate_limiter.is_rate_limited(
                            user.organization_id, limit, ep
                        )
                        
                        # Add rate limit headers
                        g.rate_limit_headers = {
                            'X-RateLimit-Limit': str(max_limit),
                            'X-RateLimit-Remaining': str(max(0, max_limit - current)),
                            'X-RateLimit-Reset': str(reset)
                        }
                        
                        if is_limited:
                            return jsonify({
                                'error': 'Rate limit exceeded',
                                'message': f'Too many requests. Limit is {max_limit}/minute.',
                                'retry_after': reset
                            }), 429
            except Exception as e:
                print(f"[RateLimiter] Error in decorator: {e}")
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def add_rate_limit_headers(response):
    """Add rate limit headers to response (call in after_request)."""
    if hasattr(g, 'rate_limit_headers'):
        for header, value in g.rate_limit_headers.items():
            response.headers[header] = value
    return response
