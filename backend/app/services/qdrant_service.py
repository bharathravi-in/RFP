"""
Qdrant Vector Database Service.

Handles embeddings storage and semantic search.
"""
import logging
import hashlib
from typing import List, Dict, Optional
from flask import current_app
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Try to import Qdrant client
try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import (
        Distance, VectorParams, PointStruct,
        Filter, FieldCondition, MatchValue
    )
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    logger.warning("qdrant-client not installed")


class QdrantService:
    """Service for vector storage and semantic search using Qdrant."""
    
    COLLECTION_NAME = "knowledge_base"
    EMBEDDING_DIMENSION = 768  # Default dimension (can vary by provider)
    
    def __init__(self, org_id: int = None):
        self.enabled = False
        self.client = None
        self.org_id = org_id
        self.embedding_provider = None
        
        if not QDRANT_AVAILABLE:
            logger.warning("Qdrant client not available")
            return
        
        qdrant_url = current_app.config.get('QDRANT_URL', 'http://localhost:6333')
        api_key = current_app.config.get('QDRANT_API_KEY')
        
        try:
            self.client = QdrantClient(
                url=qdrant_url,
                api_key=api_key,
                timeout=10
            )
            self._ensure_collection()
            self.enabled = True
            logger.info("Qdrant connection established")
            
            # Initialize embedding provider if org_id provided
            if org_id:
                self._init_embedding_provider(org_id)
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
    
    def _ensure_collection(self):
        """Create collection if it doesn't exist."""
        collections = self.client.get_collections().collections
        exists = any(c.name == self.COLLECTION_NAME for c in collections)
        
        if not exists:
            self.client.create_collection(
                collection_name=self.COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=self.EMBEDDING_DIMENSION,
                    distance=Distance.COSINE
                )
            )
            logger.info(f"Created collection: {self.COLLECTION_NAME}")
    
    def _init_embedding_provider(self, org_id: int):
        """Initialize embedding provider from organization config."""
        from app.models import OrganizationAIConfig
        from app.services.embedding_providers import EmbeddingProviderFactory
        
        config = OrganizationAIConfig.query.filter_by(
            organization_id=org_id,
            is_active=True
        ).first()
        
        if config:
            try:
                self.embedding_provider = EmbeddingProviderFactory.create(
                    provider=config.embedding_provider,
                    api_key=config.get_embedding_key(),
                    model=config.embedding_model,
                    endpoint=config.embedding_api_endpoint
                )
                logger.info(f"Initialized {config.embedding_provider} embedding provider for org {org_id}")
            except Exception as e:
                logger.error(f"Failed to initialize embedding provider: {e}")
                self._init_fallback_provider()
        else:
            logger.warning(f"No AI config found for org {org_id}, using fallback")
            self._init_fallback_provider()
    
    def _init_fallback_provider(self):
        """Initialize fallback provider using system environment variables."""
        from app.services.embedding_providers import GoogleEmbeddingProvider
        
        api_key = current_app.config.get('GOOGLE_API_KEY')
        if api_key:
            self.embedding_provider = GoogleEmbeddingProvider(api_key=api_key)
            logger.info("Using fallback Google AI provider from environment")
        else:
            logger.warning("No fallback API key configured")
    
    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding using configured provider."""
        if self.embedding_provider:
            return self.embedding_provider.get_embedding(text)
        else:
            # Ultimate fallback to hardcoded Google AI
            api_key = current_app.config.get('GOOGLE_API_KEY')
            if not api_key:
                raise ValueError("No embedding provider configured and GOOGLE_API_KEY not set")
            
            genai.configure(api_key=api_key)
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
    
    def _generate_point_id(self, item_id: int, org_id: int) -> str:
        """Generate unique point ID."""
        return hashlib.md5(f"{org_id}:{item_id}".encode()).hexdigest()
    
    def upsert_item(
        self,
        item_id: int,
        org_id: int,
        title: str,
        content: str,
        folder_id: Optional[int] = None,
        tags: List[str] = None,
        metadata: Dict = None,
        # Dimension fields for filtering
        geography: str = None,
        client_type: str = None,
        industry: str = None,
        knowledge_profile_id: int = None
    ) -> str:
        """
        Add or update a knowledge item in Qdrant.
        
        Returns:
            The point ID (embedding_id)
        """
        if not self.enabled:
            logger.debug("Qdrant not enabled, skipping upsert")
            return ""
        
        # Combine title and content for embedding
        text_to_embed = f"{title}\n\n{content}"
        embedding = self._get_embedding(text_to_embed)
        
        point_id = self._generate_point_id(item_id, org_id)
        
        payload = {
            "item_id": item_id,
            "org_id": org_id,
            "title": title,
            "content_preview": content[:500],
            "folder_id": folder_id,
            "tags": tags or [],
            # Add dimension fields to payload for filtering
            "geography": geography,
            "client_type": client_type,
            "industry": industry,
            "knowledge_profile_id": knowledge_profile_id,
            **(metadata or {})
        }
        
        self.client.upsert(
            collection_name=self.COLLECTION_NAME,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload
                )
            ]
        )
        
        return point_id
    
    def delete_item(self, item_id: int, org_id: int) -> bool:
        """Delete a knowledge item from Qdrant."""
        if not self.enabled:
            return False
        
        point_id = self._generate_point_id(item_id, org_id)
        
        try:
            self.client.delete(
                collection_name=self.COLLECTION_NAME,
                points_selector=[point_id]
            )
            return True
        except Exception as e:
            logger.error(f"Failed to delete from Qdrant: {e}")
            return False
    
    def search(
        self,
        query: str,
        org_id: int,
        folder_id: Optional[int] = None,
        limit: int = 10,
        score_threshold: float = 0.3,
        filters: Dict = None  # NEW: support dimension filters
    ) -> List[Dict]:
        """
        Semantic search in knowledge base with dimension filtering.
        
        Args:
            query: Search query text
            org_id: Organization ID
            folder_id: Optional folder filter
            limit: Max results
            score_threshold: Minimum similarity score
            filters: Optional dimension filters dict with keys:
                - geography, client_type, industry
                - knowledge_profile_ids (list of profile IDs)
        
        Returns:
            List of results with item_id, score, and preview
        """
        if not self.enabled:
            return []
        
        # Get query embedding
        query_embedding = self._get_embedding(query)
        
        # Build filter conditions
        filter_conditions = [
            FieldCondition(key="org_id", match=MatchValue(value=org_id))
        ]
        if folder_id is not None:
            filter_conditions.append(
                FieldCondition(key="folder_id", match=MatchValue(value=folder_id))
            )
        
        # Add dimension filters
        if filters:
            if filters.get('geography'):
                filter_conditions.append(
                    FieldCondition(key="geography", match=MatchValue(value=filters['geography']))
                )
            if filters.get('client_type'):
                filter_conditions.append(
                    FieldCondition(key="client_type", match=MatchValue(value=filters['client_type']))
                )
            if filters.get('industry'):
                filter_conditions.append(
                    FieldCondition(key="industry", match=MatchValue(value=filters['industry']))
                )
            # Filter by knowledge profile IDs (match any)
            if filters.get('knowledge_profile_ids'):
                profile_ids = filters['knowledge_profile_ids']
                # For profile matching, we need items that match ANY of the profile IDs
                # Using MatchAny if available, otherwise we'll match first profile
                if len(profile_ids) == 1:
                    filter_conditions.append(
                        FieldCondition(key="knowledge_profile_id", match=MatchValue(value=profile_ids[0]))
                    )
                else:
                    # Match any of the profile IDs - need MatchAny
                    try:
                        from qdrant_client.models import MatchAny
                        filter_conditions.append(
                            FieldCondition(key="knowledge_profile_id", match=MatchAny(any=profile_ids))
                        )
                    except ImportError:
                        # Fallback to first profile if MatchAny not available
                        filter_conditions.append(
                            FieldCondition(key="knowledge_profile_id", match=MatchValue(value=profile_ids[0]))
                        )
                        logger.warning("MatchAny not available, filtering by first profile only")
        
        results = self.client.search(
            collection_name=self.COLLECTION_NAME,
            query_vector=query_embedding,
            query_filter=Filter(must=filter_conditions),
            limit=limit,
            score_threshold=score_threshold
        )
        
        return [
            {
                "item_id": r.payload.get("item_id"),
                "title": r.payload.get("title"),
                "content_preview": r.payload.get("content_preview"),
                "folder_id": r.payload.get("folder_id"),
                "tags": r.payload.get("tags", []),
                "score": round(r.score, 4),
                "geography": r.payload.get("geography"),
                "client_type": r.payload.get("client_type"),
                "industry": r.payload.get("industry"),
                "knowledge_profile_id": r.payload.get("knowledge_profile_id")
            }
            for r in results
        ]
    
    def reindex_all(self, items: List[Dict], org_id: int) -> int:
        """Reindex all knowledge items for an organization."""
        if not self.enabled:
            return 0
        
        count = 0
        for item in items:
            try:
                self.upsert_item(
                    item_id=item['id'],
                    org_id=org_id,
                    title=item['title'],
                    content=item['content'],
                    folder_id=item.get('folder_id'),
                    tags=item.get('tags', [])
                )
                count += 1
            except Exception as e:
                logger.error(f"Failed to index item {item['id']}: {e}")
        
        return count


# Singleton
_qdrant_instance = None

def get_qdrant_service(org_id: int = None) -> QdrantService:
    """
    Get Qdrant service instance.
    
    Args:
        org_id: Organization ID for provider initialization (optional)
        
    Returns:
        QdrantService instance
    """
    global _qdrant_instance
    if _qdrant_instance is None or (org_id and _qdrant_instance.org_id != org_id):
        _qdrant_instance = QdrantService(org_id=org_id)
    return _qdrant_instance
