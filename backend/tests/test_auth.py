"""
Tests for authentication routes.
"""
import json
import pytest


class TestAuthRegister:
    """Test user registration."""
    
    def test_register_success(self, client):
        """Test successful registration."""
        response = client.post(
            '/api/auth/register',
            data=json.dumps({
                'email': 'newuser@test.com',
                'password': 'securepassword123',
                'name': 'New User'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['email'] == 'newuser@test.com'
    
    def test_register_missing_fields(self, client):
        """Test registration with missing fields."""
        response = client.post(
            '/api/auth/register',
            data=json.dumps({
                'email': 'incomplete@test.com'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_register_duplicate_email(self, client, test_user):
        """Test registration with existing email."""
        response = client.post(
            '/api/auth/register',
            data=json.dumps({
                'email': test_user.email,
                'password': 'password123',
                'name': 'Duplicate User'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 409
    
    def test_register_with_organization(self, client):
        """Test registration with organization name."""
        response = client.post(
            '/api/auth/register',
            data=json.dumps({
                'email': 'orguser@test.com',
                'password': 'password123',
                'name': 'Org User',
                'organization_name': 'My Company'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['organization'] is not None
        assert data['organization']['name'] == 'My Company'


class TestAuthLogin:
    """Test user login."""
    
    def test_login_success(self, client, test_user):
        """Test successful login."""
        response = client.post(
            '/api/auth/login',
            data=json.dumps({
                'email': test_user.email,
                'password': 'testpassword123'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['id'] == test_user.id
    
    def test_login_invalid_password(self, client, test_user):
        """Test login with wrong password."""
        response = client.post(
            '/api/auth/login',
            data=json.dumps({
                'email': test_user.email,
                'password': 'wrongpassword'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent email."""
        response = client.post(
            '/api/auth/login',
            data=json.dumps({
                'email': 'nobody@test.com',
                'password': 'password123'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 401


class TestAuthMe:
    """Test current user endpoint."""
    
    def test_get_current_user(self, client, auth_headers, test_user):
        """Test getting current user info."""
        response = client.get(
            '/api/auth/me',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['email'] == test_user.email
    
    def test_get_current_user_no_auth(self, client):
        """Test accessing protected route without auth."""
        response = client.get('/api/auth/me')
        
        assert response.status_code == 401
