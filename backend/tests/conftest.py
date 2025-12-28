"""
Pytest fixtures and configuration for RFP application tests.
"""
import pytest
from flask import Flask
from flask_jwt_extended import create_access_token
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    from app import create_app
    
    # Override config for testing
    test_config = {
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'WTF_CSRF_ENABLED': False,
        'JWT_SECRET_KEY': 'test-secret-key',
        'RATELIMIT_ENABLED': False,  # Disable rate limiting for tests
    }
    
    app = create_app(test_config)
    
    with app.app_context():
        from app import db
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Test client for making requests."""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Database session for tests."""
    from app import db
    with app.app_context():
        yield db.session
        db.session.rollback()


@pytest.fixture
def auth_headers(app):
    """Generate authentication headers for protected endpoints."""
    with app.app_context():
        # Create a test user token
        access_token = create_access_token(identity='1')  # User ID 1
        return {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }


@pytest.fixture
def sample_user(db_session):
    """Create a sample user for tests."""
    from app.models import User, Organization
    
    # Create org first
    org = Organization(name='Test Organization')
    db_session.add(org)
    db_session.flush()
    
    # Create user
    user = User(
        email='test@example.com',
        name='Test User',
        organization_id=org.id
    )
    user.set_password('testpassword123')
    db_session.add(user)
    db_session.commit()
    
    return user


@pytest.fixture
def sample_project(db_session, sample_user):
    """Create a sample project for tests."""
    from app.models import Project
    
    project = Project(
        name='Test Project',
        client_name='Test Client',
        created_by=sample_user.id,
        organization_id=sample_user.organization_id
    )
    db_session.add(project)
    db_session.commit()
    
    return project


# Utility functions for tests
def assert_json_response(response, status_code=200):
    """Assert response is JSON with expected status code."""
    assert response.status_code == status_code
    assert response.content_type == 'application/json'
    return response.get_json()


def assert_error_response(response, status_code, error_contains=None):
    """Assert error response format."""
    data = assert_json_response(response, status_code)
    assert 'error' in data
    if error_contains:
        assert error_contains.lower() in data['error'].lower()
    return data
