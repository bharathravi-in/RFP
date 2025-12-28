"""
Integration tests for knowledge base API endpoints.
"""
import pytest
from tests.conftest import assert_json_response


class TestKnowledgeAPI:
    """Integration tests for /api/knowledge endpoints."""
    
    @pytest.mark.integration
    def test_list_knowledge_items(self, client, auth_headers):
        """Test listing knowledge items."""
        response = client.get('/api/knowledge', headers=auth_headers)
        data = assert_json_response(response, 200)
        assert isinstance(data, list)
    
    @pytest.mark.integration
    def test_list_folders(self, client, auth_headers):
        """Test listing knowledge folders."""
        response = client.get('/api/folders', headers=auth_headers)
        data = assert_json_response(response, 200)
        assert isinstance(data, list)
    
    @pytest.mark.integration
    def test_search_knowledge(self, client, auth_headers):
        """Test knowledge base search."""
        response = client.get(
            '/api/knowledge/search?q=test',
            headers=auth_headers
        )
        # Might return empty results but should not error
        assert response.status_code in [200, 404]


class TestKnowledgeChatAPI:
    """Integration tests for knowledge chat endpoints."""
    
    @pytest.mark.integration
    def test_chat_session_requires_valid_item(self, client, auth_headers):
        """Test chat session creation requires valid knowledge item."""
        response = client.get('/api/knowledge/99999/chat', headers=auth_headers)
        assert response.status_code == 404
