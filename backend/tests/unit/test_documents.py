"""
Unit tests for document routes.
"""
import pytest
from tests.conftest import assert_json_response, assert_error_response


class TestDocumentRoutes:
    """Tests for /api/documents endpoints."""
    
    @pytest.mark.unit
    def test_list_documents_requires_auth(self, client):
        """Test document list requires authentication."""
        response = client.get('/api/documents')
        assert response.status_code == 401
    
    @pytest.mark.unit
    def test_upload_requires_auth(self, client):
        """Test document upload requires authentication."""
        response = client.post('/api/documents', data={})
        assert response.status_code == 401
    
    @pytest.mark.unit
    def test_get_document_requires_auth(self, client):
        """Test getting a document requires authentication."""
        response = client.get('/api/documents/1')
        assert response.status_code == 401


class TestDocumentValidation:
    """Tests for document input validation."""
    
    @pytest.mark.unit
    def test_upload_requires_file(self, client, auth_headers):
        """Test upload requires a file to be attached."""
        response = client.post(
            '/api/documents?project_id=1',
            headers=auth_headers,
            data={}
        )
        # Should fail because no file provided
        assert response.status_code in [400, 404, 422]
    
    @pytest.mark.unit  
    def test_upload_requires_project_id(self, client, auth_headers):
        """Test upload requires project_id parameter."""
        response = client.post(
            '/api/documents',
            headers=auth_headers,
            data={}
        )
        assert response.status_code in [400, 422]
