"""
Pytest configuration for backend tests.
"""
import pytest
from flask import Flask
from flask_jwt_extended import create_access_token
from app import create_app
from app.extensions import db
from app.models import User, Organization


@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    app = create_app('testing')
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture(scope='function')
def db_session(app):
    """Create database session for testing."""
    with app.app_context():
        yield db.session
        db.session.rollback()


@pytest.fixture(scope='function')
def test_user(app, db_session):
    """Create a test user."""
    with app.app_context():
        user = User(
            email='testuser@test.com',
            name='Test User',
            role='admin'
        )
        user.set_password('testpassword123')
        db_session.add(user)
        db_session.commit()
        
        yield user
        
        # Cleanup
        db_session.delete(user)
        db_session.commit()


@pytest.fixture(scope='function')
def test_org(app, db_session, test_user):
    """Create a test organization."""
    with app.app_context():
        org = Organization(
            name='Test Organization',
            slug='test-org',
            settings={}
        )
        db_session.add(org)
        db_session.commit()
        
        # Assign user to org
        test_user.organization_id = org.id
        db_session.commit()
        
        yield org


@pytest.fixture(scope='function')
def auth_headers(app, test_user):
    """Generate auth headers with valid JWT."""
    with app.app_context():
        token = create_access_token(identity=str(test_user.id))
        return {'Authorization': f'Bearer {token}'}
