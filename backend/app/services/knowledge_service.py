"""Knowledge base service for semantic search with Qdrant."""
import os
from typing import Optional
import uuid


class KnowledgeService:
    """Handle knowledge base operations and semantic search."""
    
    def __init__(self):
        self.qdrant_host = os.getenv('QDRANT_HOST', 'localhost')
        self.qdrant_port = int(os.getenv('QDRANT_PORT', 6333))
        self.collection_name = os.getenv('QDRANT_COLLECTION', 'knowledge_base')
        self._client = None
        self._embedder = None
    
    @property
    def client(self):
        """Lazy load Qdrant client."""
        if self._client is None:
            try:
                from qdrant_client import QdrantClient
                self._client = QdrantClient(
                    host=self.qdrant_host,
                    port=self.qdrant_port
                )
            except Exception:
                pass
        return self._client
    
    @property
    def embedder(self):
        """Lazy load sentence transformer for embeddings."""
        if self._embedder is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._embedder = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception:
                pass
        return self._embedder
    
    def ensure_collection(self):
        """Ensure the Qdrant collection exists."""
        if not self.client:
            return False
        
        try:
            from qdrant_client.models import Distance, VectorParams
            
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if not exists:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=384,  # all-MiniLM-L6-v2 dimension
                        distance=Distance.COSINE
                    )
                )
            return True
        except Exception:
            return False
    
    def create_embedding(self, content: str) -> Optional[str]:
        """Create and store embedding for content."""
        if not self.client or not self.embedder:
            return None
        
        try:
            from qdrant_client.models import PointStruct
            
            self.ensure_collection()
            
            # Generate embedding
            embedding = self.embedder.encode(content).tolist()
            
            # Generate unique ID
            point_id = str(uuid.uuid4())
            
            # Upsert to Qdrant
            self.client.upsert(
                collection_name=self.collection_name,
                points=[
                    PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload={'content': content[:1000]}  # Store truncated content
                    )
                ]
            )
            
            return point_id
        except Exception:
            return None
    
    def semantic_search(
        self,
        query: str,
        organization_id: int,
        limit: int = 5
    ) -> list[dict]:
        """Search knowledge base semantically."""
        if not self.client or not self.embedder:
            return []
        
        try:
            # Generate query embedding
            query_embedding = self.embedder.encode(query).tolist()
            
            # Search Qdrant
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit
            )
            
            return [
                {
                    'id': hit.id,
                    'score': hit.score,
                    'content': hit.payload.get('content', '')
                }
                for hit in results
            ]
        except Exception:
            return []
    
    def delete_embedding(self, embedding_id: str) -> bool:
        """Delete an embedding from Qdrant."""
        if not self.client:
            return False
        
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=[embedding_id]
            )
            return True
        except Exception:
            return False


# Singleton instance
knowledge_service = KnowledgeService()
