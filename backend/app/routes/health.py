"""
Health check endpoints for the RFP application.

Provides:
- /health - Simple liveness check
- /ready - Readiness check with dependency verification
"""
from flask import Blueprint, jsonify, current_app
import logging
import time

logger = logging.getLogger(__name__)

bp = Blueprint('health', __name__)


@bp.route('/health')
def health():
    """
    Liveness probe endpoint.
    
    Returns 200 if the application is running.
    Used by container orchestrators for liveness checks.
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'service': 'rfp-backend'
    }), 200


@bp.route('/ready')
def ready():
    """
    Readiness probe endpoint.
    
    Checks all dependencies and returns readiness status.
    Used by load balancers to determine if traffic should be routed.
    """
    checks = {}
    overall_status = 'ready'
    
    # Check database
    try:
        from app import db
        db.session.execute('SELECT 1')
        checks['database'] = {'status': 'ok'}
    except Exception as e:
        checks['database'] = {'status': 'error', 'message': str(e)}
        overall_status = 'not_ready'
    
    # Check Redis
    try:
        import redis
        import os
        redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        r.ping()
        checks['redis'] = {'status': 'ok'}
    except Exception as e:
        checks['redis'] = {'status': 'error', 'message': str(e)}
        # Redis is optional, don't fail readiness
        checks['redis']['optional'] = True
    
    # Check Qdrant
    try:
        import os
        qdrant_url = os.environ.get('QDRANT_URL')
        if qdrant_url:
            from qdrant_client import QdrantClient
            client = QdrantClient(url=qdrant_url)
            client.get_collections()
            checks['qdrant'] = {'status': 'ok'}
        else:
            checks['qdrant'] = {'status': 'not_configured'}
    except Exception as e:
        checks['qdrant'] = {'status': 'error', 'message': str(e)}
        checks['qdrant']['optional'] = True
    
    status_code = 200 if overall_status == 'ready' else 503
    
    return jsonify({
        'status': overall_status,
        'timestamp': time.time(),
        'checks': checks
    }), status_code


@bp.route('/metrics')
def metrics():
    """
    Basic metrics endpoint.
    
    Returns application metrics in a simple JSON format.
    For production, consider using prometheus_client or similar.
    """
    import os
    import psutil
    
    process = psutil.Process(os.getpid())
    
    return jsonify({
        'uptime_seconds': time.time() - process.create_time(),
        'memory_mb': process.memory_info().rss / 1024 / 1024,
        'cpu_percent': process.cpu_percent(),
        'threads': process.num_threads(),
    }), 200


@bp.route('/circuit-breakers')
def circuit_breaker_status():
    """
    Circuit breaker status endpoint.
    
    Returns the status of all registered circuit breakers
    for monitoring and alerting purposes.
    """
    try:
        from app.services.circuit_breaker import CircuitBreaker
        
        breakers = CircuitBreaker.get_all_stats()
        
        # Determine overall status
        any_open = any(
            b.get('state') == 'open' 
            for b in breakers.values()
        )
        
        return jsonify({
            'status': 'degraded' if any_open else 'healthy',
            'timestamp': time.time(),
            'circuit_breakers': breakers
        }), 200 if not any_open else 503
        
    except ImportError:
        return jsonify({
            'status': 'not_configured',
            'message': 'Circuit breaker module not available'
        }), 200

