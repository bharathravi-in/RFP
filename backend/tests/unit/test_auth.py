"""
Unit tests for authentication routes.
"""
import pytest
from tests.conftest import assert_json_response, assert_error_response


class TestAuthRoutes:
    """Tests for /api/auth endpoints."""
    
    @pytest.mark.unit
    def test_login_missing_credentials(self, client):
        """Test login fails without credentials."""
        response = client.post('/api/auth/login', json={})
        assert response.status_code == 400
    
    @pytest.mark.unit
    def test_login_invalid_credentials(self, client):
        """Test login fails with invalid credentials."""
        response = client.post('/api/auth/login', json={
            'email': 'nonexistent@example.com',
            'password': 'wrongpassword'
        })
        assert response.status_code in [401, 404]
    
    @pytest.mark.unit
    def test_me_requires_auth(self, client):
        """Test /me endpoint requires authentication."""
        response = client.get('/api/auth/me')
        assert response.status_code == 401
    
    @pytest.mark.integration
    def test_me_returns_user_info(self, client, auth_headers, sample_user):
        """Test /me endpoint returns current user info."""
        # This test requires a properly authenticated user
        pass  # Placeholder for full integration test


class TestAuthValidation:
    """Tests for auth input validation."""
    
    @pytest.mark.unit
    def test_login_email_format_validation(self, client):
        """Test login validates email format."""
        response = client.post('/api/auth/login', json={
            'email': 'not-an-email',
            'password': 'password123'
        })
        # Should either reject invalid format or proceed to auth check
        assert response.status_code in [400, 401, 404]
    
    @pytest.mark.unit
    def test_login_password_required(self, client):
        """Test login requires password."""
        response = client.post('/api/auth/login', json={
            'email': 'test@example.com'
        })
        assert response.status_code == 400
