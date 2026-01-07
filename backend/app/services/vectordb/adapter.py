"""
Vector Database Adapter

Abstraction layer over Qdrant with pluggable adapters for alternatives:
- Qdrant (default)
- Milvus
- Pinecone
- Weaviate
- SQL fallback (PostgreSQL pgvector)

Usage:
    from vectordb_adapter import VectorDBFactory
    
    # Create adapter (reads from config/env)
    adapter = VectorDBFactory.create("qdrant")
    
    # Create collection
    adapter.create_collection("knowledge_base", dimension=768)
    
    # Upsert vectors
    adapter.upsert("knowledge_base", [
        {"id": "doc1", "vector": [...], "payload": {"title": "..."}}
    ])
    
    # Query
    results = adapter.query("knowledge_base", query_vector, top_k=10)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
import logging
import os

logger = logging.getLogger(__name__)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class VectorRecord:
    """A single vector record."""
    id: str
    vector: List[float]
    payload: Optional[Dict[str, Any]] = None
    score: Optional[float] = None


@dataclass
class SearchResult:
    """Search result with score."""
    id: str
    score: float
    payload: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "score": self.score,
            "payload": self.payload
        }


@dataclass
class CollectionInfo:
    """Collection metadata."""
    name: str
    dimension: int
    count: int
    distance_metric: str = "cosine"


# ============================================================================
# Abstract Base Adapter
# ============================================================================

class VectorDBAdapter(ABC):
    """
    Abstract base class for vector database adapters.
    
    Implementations must provide:
    - create_collection()
    - delete_collection()
    - upsert()
    - query()
    - delete()
    - health()
    """
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider identifier."""
        pass
    
    @abstractmethod
    def create_collection(
        self,
        name: str,
        dimension: int,
        distance_metric: str = "cosine",
        **kwargs
    ) -> bool:
        """
        Create a new collection (index).
        
        Args:
            name: Collection name
            dimension: Vector dimension
            distance_metric: "cosine", "euclidean", or "dot"
            **kwargs: Provider-specific options
            
        Returns:
            True if created successfully
        """
        pass
    
    @abstractmethod
    def delete_collection(self, name: str) -> bool:
        """Delete a collection."""
        pass
    
    @abstractmethod
    def get_collection_info(self, name: str) -> Optional[CollectionInfo]:
        """Get collection metadata."""
        pass
    
    @abstractmethod
    def upsert(
        self,
        collection: str,
        records: List[VectorRecord],
        **kwargs
    ) -> int:
        """
        Insert or update vectors.
        
        Args:
            collection: Collection name
            records: List of VectorRecord objects
            **kwargs: Provider-specific options
            
        Returns:
            Number of records upserted
        """
        pass
    
    @abstractmethod
    def query(
        self,
        collection: str,
        query_vector: List[float],
        top_k: int = 10,
        filter: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
        **kwargs
    ) -> List[SearchResult]:
        """
        Query for similar vectors.
        
        Args:
            collection: Collection name
            query_vector: Query vector
            top_k: Number of results
            filter: Payload filter conditions
            score_threshold: Minimum similarity score
            **kwargs: Provider-specific options
            
        Returns:
            List of SearchResult objects
        """
        pass
    
    @abstractmethod
    def delete(
        self,
        collection: str,
        ids: List[str],
        **kwargs
    ) -> int:
        """
        Delete vectors by ID.
        
        Args:
            collection: Collection name
            ids: List of vector IDs to delete
            
        Returns:
            Number of records deleted
        """
        pass
    
    @abstractmethod
    def health(self) -> Dict[str, Any]:
        """
        Check database health.
        
        Returns:
            Dict with 'healthy' bool and 'message'
        """
        pass


# ============================================================================
# Qdrant Adapter
# ============================================================================

class QdrantAdapter(VectorDBAdapter):
    """Qdrant vector database adapter."""
    
    def __init__(
        self,
        url: str = None,
        api_key: str = None,
        timeout: int = 30
    ):
        self.url = url or os.environ.get("QDRANT_URL", "http://localhost:6333")
        self.api_key = api_key or os.environ.get("QDRANT_API_KEY")
        self.timeout = timeout
        self._client = None
    
    @property
    def provider_name(self) -> str:
        return "qdrant"
    
    @property
    def client(self):
        if self._client is None:
            try:
                from qdrant_client import QdrantClient
                self._client = QdrantClient(
                    url=self.url,
                    api_key=self.api_key,
                    timeout=self.timeout
                )
            except ImportError:
                raise ImportError("qdrant-client required: pip install qdrant-client")
        return self._client
    
    def create_collection(
        self,
        name: str,
        dimension: int,
        distance_metric: str = "cosine",
        **kwargs
    ) -> bool:
        from qdrant_client.models import Distance, VectorParams
        
        distance_map = {
            "cosine": Distance.COSINE,
            "euclidean": Distance.EUCLID,
            "dot": Distance.DOT
        }
        
        try:
            self.client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=dimension,
                    distance=distance_map.get(distance_metric, Distance.COSINE)
                )
            )
            logger.info(f"Created Qdrant collection: {name}")
            return True
        except Exception as e:
            logger.error(f"Failed to create collection: {e}")
            return False
    
    def delete_collection(self, name: str) -> bool:
        try:
            self.client.delete_collection(name)
            return True
        except Exception as e:
            logger.error(f"Failed to delete collection: {e}")
            return False
    
    def get_collection_info(self, name: str) -> Optional[CollectionInfo]:
        try:
            info = self.client.get_collection(name)
            return CollectionInfo(
                name=name,
                dimension=info.config.params.vectors.size,
                count=info.points_count,
                distance_metric=str(info.config.params.vectors.distance).lower()
            )
        except Exception:
            return None
    
    def upsert(
        self,
        collection: str,
        records: List[VectorRecord],
        **kwargs
    ) -> int:
        from qdrant_client.models import PointStruct
        
        points = [
            PointStruct(
                id=r.id,
                vector=r.vector,
                payload=r.payload or {}
            )
            for r in records
        ]
        
        self.client.upsert(collection_name=collection, points=points)
        return len(points)
    
    def query(
        self,
        collection: str,
        query_vector: List[float],
        top_k: int = 10,
        filter: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
        **kwargs
    ) -> List[SearchResult]:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        
        query_filter = None
        if filter:
            conditions = []
            for key, value in filter.items():
                conditions.append(
                    FieldCondition(key=key, match=MatchValue(value=value))
                )
            query_filter = Filter(must=conditions)
        
        results = self.client.search(
            collection_name=collection,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
            score_threshold=score_threshold
        )
        
        return [
            SearchResult(
                id=str(r.id),
                score=r.score,
                payload=r.payload or {}
            )
            for r in results
        ]
    
    def delete(
        self,
        collection: str,
        ids: List[str],
        **kwargs
    ) -> int:
        self.client.delete(
            collection_name=collection,
            points_selector=ids
        )
        return len(ids)
    
    def health(self) -> Dict[str, Any]:
        try:
            collections = self.client.get_collections()
            return {
                "healthy": True,
                "provider": "qdrant",
                "message": f"Connected, {len(collections.collections)} collections",
                "url": self.url
            }
        except Exception as e:
            return {
                "healthy": False,
                "provider": "qdrant",
                "message": f"Health check failed: {str(e)}",
                "url": self.url
            }


# ============================================================================
# Pinecone Adapter
# ============================================================================

class PineconeAdapter(VectorDBAdapter):
    """Pinecone vector database adapter."""
    
    def __init__(
        self,
        api_key: str = None,
        environment: str = None
    ):
        self.api_key = api_key or os.environ.get("PINECONE_API_KEY")
        self.environment = environment or os.environ.get("PINECONE_ENVIRONMENT")
        self._pc = None
        self._indexes = {}
    
    @property
    def provider_name(self) -> str:
        return "pinecone"
    
    @property
    def pc(self):
        if self._pc is None:
            try:
                from pinecone import Pinecone
                self._pc = Pinecone(api_key=self.api_key)
            except ImportError:
                raise ImportError("pinecone-client required: pip install pinecone-client")
        return self._pc
    
    def create_collection(
        self,
        name: str,
        dimension: int,
        distance_metric: str = "cosine",
        **kwargs
    ) -> bool:
        try:
            self.pc.create_index(
                name=name,
                dimension=dimension,
                metric=distance_metric,
                spec=kwargs.get("spec", {"serverless": {"cloud": "aws", "region": "us-east-1"}})
            )
            return True
        except Exception as e:
            logger.error(f"Failed to create Pinecone index: {e}")
            return False
    
    def delete_collection(self, name: str) -> bool:
        try:
            self.pc.delete_index(name)
            return True
        except Exception as e:
            logger.error(f"Failed to delete index: {e}")
            return False
    
    def get_collection_info(self, name: str) -> Optional[CollectionInfo]:
        try:
            desc = self.pc.describe_index(name)
            return CollectionInfo(
                name=name,
                dimension=desc.dimension,
                count=desc.total_vector_count,
                distance_metric=desc.metric
            )
        except Exception:
            return None
    
    def _get_index(self, name: str):
        if name not in self._indexes:
            self._indexes[name] = self.pc.Index(name)
        return self._indexes[name]
    
    def upsert(
        self,
        collection: str,
        records: List[VectorRecord],
        **kwargs
    ) -> int:
        index = self._get_index(collection)
        vectors = [
            {
                "id": r.id,
                "values": r.vector,
                "metadata": r.payload or {}
            }
            for r in records
        ]
        index.upsert(vectors=vectors)
        return len(vectors)
    
    def query(
        self,
        collection: str,
        query_vector: List[float],
        top_k: int = 10,
        filter: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
        **kwargs
    ) -> List[SearchResult]:
        index = self._get_index(collection)
        
        results = index.query(
            vector=query_vector,
            top_k=top_k,
            filter=filter,
            include_metadata=True
        )
        
        search_results = []
        for match in results.matches:
            if score_threshold and match.score < score_threshold:
                continue
            search_results.append(SearchResult(
                id=match.id,
                score=match.score,
                payload=match.metadata or {}
            ))
        return search_results
    
    def delete(
        self,
        collection: str,
        ids: List[str],
        **kwargs
    ) -> int:
        index = self._get_index(collection)
        index.delete(ids=ids)
        return len(ids)
    
    def health(self) -> Dict[str, Any]:
        try:
            indexes = self.pc.list_indexes()
            return {
                "healthy": True,
                "provider": "pinecone",
                "message": f"Connected, {len(indexes)} indexes"
            }
        except Exception as e:
            return {
                "healthy": False,
                "provider": "pinecone",
                "message": f"Health check failed: {str(e)}"
            }


# ============================================================================
# PostgreSQL pgvector Adapter (SQL Fallback)
# ============================================================================

class PGVectorAdapter(VectorDBAdapter):
    """PostgreSQL with pgvector extension - SQL fallback adapter."""
    
    def __init__(
        self,
        connection_string: str = None
    ):
        self.connection_string = connection_string or os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/vectors"
        )
        self._conn = None
    
    @property
    def provider_name(self) -> str:
        return "pgvector"
    
    @property
    def conn(self):
        if self._conn is None:
            try:
                import psycopg2
                self._conn = psycopg2.connect(self.connection_string)
            except ImportError:
                raise ImportError("psycopg2 required: pip install psycopg2-binary")
        return self._conn
    
    def create_collection(
        self,
        name: str,
        dimension: int,
        distance_metric: str = "cosine",
        **kwargs
    ) -> bool:
        try:
            with self.conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS {name} (
                        id TEXT PRIMARY KEY,
                        embedding vector({dimension}),
                        payload JSONB DEFAULT '{{}}'
                    )
                """)
                cur.execute(f"""
                    CREATE INDEX IF NOT EXISTS {name}_embedding_idx 
                    ON {name} USING ivfflat (embedding vector_cosine_ops)
                """)
            self.conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to create pgvector table: {e}")
            self.conn.rollback()
            return False
    
    def delete_collection(self, name: str) -> bool:
        try:
            with self.conn.cursor() as cur:
                cur.execute(f"DROP TABLE IF EXISTS {name}")
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            return False
    
    def get_collection_info(self, name: str) -> Optional[CollectionInfo]:
        try:
            with self.conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {name}")
                count = cur.fetchone()[0]
            return CollectionInfo(
                name=name,
                dimension=768,  # Would need schema introspection
                count=count,
                distance_metric="cosine"
            )
        except Exception:
            return None
    
    def upsert(
        self,
        collection: str,
        records: List[VectorRecord],
        **kwargs
    ) -> int:
        import json
        try:
            with self.conn.cursor() as cur:
                for r in records:
                    cur.execute(f"""
                        INSERT INTO {collection} (id, embedding, payload)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            embedding = EXCLUDED.embedding,
                            payload = EXCLUDED.payload
                    """, (r.id, r.vector, json.dumps(r.payload or {})))
            self.conn.commit()
            return len(records)
        except Exception as e:
            logger.error(f"pgvector upsert failed: {e}")
            self.conn.rollback()
            return 0
    
    def query(
        self,
        collection: str,
        query_vector: List[float],
        top_k: int = 10,
        filter: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
        **kwargs
    ) -> List[SearchResult]:
        try:
            with self.conn.cursor() as cur:
                # Build filter clause
                where_clause = ""
                if filter:
                    conditions = [f"payload->>'{k}' = '{v}'" for k, v in filter.items()]
                    where_clause = "WHERE " + " AND ".join(conditions)
                
                cur.execute(f"""
                    SELECT id, 1 - (embedding <=> %s::vector) as score, payload
                    FROM {collection}
                    {where_clause}
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """, (query_vector, query_vector, top_k))
                
                results = []
                for row in cur.fetchall():
                    score = float(row[1])
                    if score_threshold and score < score_threshold:
                        continue
                    import json
                    results.append(SearchResult(
                        id=row[0],
                        score=score,
                        payload=json.loads(row[2]) if row[2] else {}
                    ))
                return results
        except Exception as e:
            logger.error(f"pgvector query failed: {e}")
            return []
    
    def delete(
        self,
        collection: str,
        ids: List[str],
        **kwargs
    ) -> int:
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    f"DELETE FROM {collection} WHERE id = ANY(%s)",
                    (ids,)
                )
                deleted = cur.rowcount
            self.conn.commit()
            return deleted
        except Exception:
            self.conn.rollback()
            return 0
    
    def health(self) -> Dict[str, Any]:
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT 1")
            return {
                "healthy": True,
                "provider": "pgvector",
                "message": "Connected to PostgreSQL"
            }
        except Exception as e:
            return {
                "healthy": False,
                "provider": "pgvector",
                "message": f"Health check failed: {str(e)}"
            }


# ============================================================================
# Factory
# ============================================================================

class VectorDBFactory:
    """Factory for creating vector database adapters."""
    
    _adapters = {
        "qdrant": QdrantAdapter,
        "pinecone": PineconeAdapter,
        "pgvector": PGVectorAdapter,
    }
    
    @classmethod
    def register(cls, name: str, adapter_class: type):
        """Register a custom adapter."""
        cls._adapters[name] = adapter_class
    
    @classmethod
    def create(cls, provider: str, **kwargs) -> VectorDBAdapter:
        """
        Create an adapter instance.
        
        Args:
            provider: Provider name (qdrant, pinecone, pgvector)
            **kwargs: Provider-specific config
        """
        adapter_class = cls._adapters.get(provider.lower())
        if not adapter_class:
            raise ValueError(
                f"Unknown provider: {provider}. "
                f"Available: {list(cls._adapters.keys())}"
            )
        return adapter_class(**kwargs)
    
    @classmethod
    def list_providers(cls) -> List[str]:
        """List available providers."""
        return list(cls._adapters.keys())


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    print("Vector DB Adapter - Available providers:", VectorDBFactory.list_providers())
    
    # Example usage:
    # adapter = VectorDBFactory.create("qdrant", url="http://localhost:6333")
    # adapter.create_collection("test", dimension=768)
    # adapter.upsert("test", [
    #     VectorRecord(id="1", vector=[0.1]*768, payload={"title": "Test"})
    # ])
    # results = adapter.query("test", [0.1]*768, top_k=5)
