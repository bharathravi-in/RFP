"""
Tests for project routes.
"""
import json
import pytest


class TestProjectList:
    """Test project listing."""
    
    def test_list_projects_empty(self, client, auth_headers):
        """Test listing projects when none exist."""
        response = client.get(
            '/api/projects',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'projects' in data
        assert isinstance(data['projects'], list)
    
    def test_list_projects_no_auth(self, client):
        """Test listing projects without auth."""
        response = client.get('/api/projects')
        assert response.status_code == 401


class TestProjectCreate:
    """Test project creation."""
    
    def test_create_project_success(self, client, auth_headers, test_org):
        """Test creating a project."""
        response = client.post(
            '/api/projects',
            data=json.dumps({
                'name': 'Test RFP Project',
                'description': 'A test project for RFP processing'
            }),
            content_type='application/json',
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['project']['name'] == 'Test RFP Project'
        assert data['project']['status'] == 'draft'
    
    def test_create_project_missing_name(self, client, auth_headers, test_org):
        """Test creating project without name."""
        response = client.post(
            '/api/projects',
            data=json.dumps({
                'description': 'No name provided'
            }),
            content_type='application/json',
            headers=auth_headers
        )
        
        assert response.status_code == 400
    
    def test_create_project_auto_creates_org(self, client, auth_headers):
        """Test that creating project auto-creates org for users without one."""
        # This user doesn't have an org
        response = client.post(
            '/api/projects',
            data=json.dumps({
                'name': 'Auto Org Test'
            }),
            content_type='application/json',
            headers=auth_headers
        )
        
        # Should succeed - org is auto-created
        assert response.status_code in [200, 201]


class TestProjectOperations:
    """Test project CRUD operations."""
    
    @pytest.fixture
    def test_project(self, client, auth_headers, test_org):
        """Create a test project."""
        response = client.post(
            '/api/projects',
            data=json.dumps({'name': 'CRUD Test Project'}),
            content_type='application/json',
            headers=auth_headers
        )
        data = json.loads(response.data)
        return data['project']
    
    def test_get_project(self, client, auth_headers, test_project):
        """Test getting a single project."""
        response = client.get(
            f"/api/projects/{test_project['id']}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['project']['id'] == test_project['id']
    
    def test_update_project(self, client, auth_headers, test_project):
        """Test updating a project."""
        response = client.put(
            f"/api/projects/{test_project['id']}",
            data=json.dumps({
                'name': 'Updated Project Name',
                'status': 'in_progress'
            }),
            content_type='application/json',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['project']['name'] == 'Updated Project Name'
    
    def test_get_nonexistent_project(self, client, auth_headers):
        """Test getting a project that doesn't exist."""
        response = client.get(
            '/api/projects/99999',
            headers=auth_headers
        )
        
        assert response.status_code == 404
