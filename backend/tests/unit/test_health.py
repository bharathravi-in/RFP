"""
Unit tests for health check endpoints.
"""
import pytest


class TestHealthEndpoints:
    """Tests for health check endpoints."""
    
    @pytest.mark.unit
    def test_health_endpoint(self, client):
        """Test /health endpoint returns OK."""
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('status') == 'healthy'
    
    @pytest.mark.unit
    def test_ready_endpoint(self, client):
        """Test /ready endpoint returns readiness status."""
        response = client.get('/ready')
        assert response.status_code == 200
        data = response.get_json()
        assert 'status' in data
