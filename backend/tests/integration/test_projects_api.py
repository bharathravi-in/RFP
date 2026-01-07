"""
Integration tests for project API endpoints.
"""
import pytest
from tests.conftest import assert_json_response, assert_error_response


class TestProjectsAPI:
    """Integration tests for /api/projects endpoints."""
    
    @pytest.mark.integration
    def test_list_projects_empty(self, client, auth_headers, sample_user):
        """Test listing projects when none exist."""
        response = client.get('/api/projects', headers=auth_headers)
        data = assert_json_response(response, 200)
        assert isinstance(data, list)
    
    @pytest.mark.integration
    def test_create_project(self, client, auth_headers, sample_user):
        """Test creating a new project."""
        response = client.post('/api/projects', headers=auth_headers, json={
            'name': 'Test Project',
            'client_name': 'Test Client',
            'description': 'A test project'
        })
        data = assert_json_response(response, 201)
        assert data['name'] == 'Test Project'
        assert data['client_name'] == 'Test Client'
        assert 'id' in data
    
    @pytest.mark.integration
    def test_create_project_missing_required_fields(self, client, auth_headers):
        """Test project creation fails without required fields."""
        response = client.post('/api/projects', headers=auth_headers, json={
            'description': 'Missing name and client'
        })
        assert response.status_code in [400, 422]
    
    @pytest.mark.integration
    def test_get_project(self, client, auth_headers, sample_project):
        """Test getting a single project."""
        response = client.get(f'/api/projects/{sample_project.id}', headers=auth_headers)
        data = assert_json_response(response, 200)
        assert data['id'] == sample_project.id
        assert data['name'] == sample_project.name
    
    @pytest.mark.integration
    def test_get_nonexistent_project(self, client, auth_headers):
        """Test getting a project that doesn't exist."""
        response = client.get('/api/projects/99999', headers=auth_headers)
        assert response.status_code == 404
    
    @pytest.mark.integration
    def test_update_project(self, client, auth_headers, sample_project):
        """Test updating a project."""
        response = client.put(
            f'/api/projects/{sample_project.id}',
            headers=auth_headers,
            json={'name': 'Updated Name'}
        )
        data = assert_json_response(response, 200)
        assert data['name'] == 'Updated Name'
    
    @pytest.mark.integration
    def test_delete_project(self, client, auth_headers, sample_project):
        """Test deleting a project."""
        response = client.delete(
            f'/api/projects/{sample_project.id}',
            headers=auth_headers
        )
        assert response.status_code in [200, 204]
        
        # Verify it's deleted
        get_response = client.get(
            f'/api/projects/{sample_project.id}',
            headers=auth_headers
        )
        assert get_response.status_code == 404
