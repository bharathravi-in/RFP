"""
Unit tests for configuration loading.
"""
import pytest
import os
from app.config import ProductionConfig

def test_production_config_pooling():
    """Test that production config loads pooling settings correctly."""
    # Mock filtering env vars
    os.environ['DB_POOL_SIZE'] = '20'
    os.environ['DB_POOL_RECYCLE'] = '300'
    
    try:
        engine_options = ProductionConfig.SQLALCHEMY_ENGINE_OPTIONS
        assert engine_options['pool_size'] == 20
        assert engine_options['pool_recycle'] == 300
        assert engine_options['pool_pre_ping'] is True
        assert engine_options['max_overflow'] == 5  # Default
    finally:
        # Cleanup
        del os.environ['DB_POOL_SIZE']
        del os.environ['DB_POOL_RECYCLE']

def test_production_config_defaults():
    """Test defaults when env vars are missing."""
    if 'DB_POOL_SIZE' in os.environ:
        del os.environ['DB_POOL_SIZE']
    
    engine_options = ProductionConfig.SQLALCHEMY_ENGINE_OPTIONS
    assert engine_options['pool_size'] == 10
    assert engine_options['pool_recycle'] == 1800
