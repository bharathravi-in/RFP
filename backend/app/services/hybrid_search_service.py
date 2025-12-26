"""
Qdrant Hybrid Search Service.

Provides hybrid search combining:
- Dense vectors (semantic embeddings) for contextual understanding
- Sparse vectors (BM25) for keyword matching
- Reciprocal Rank Fusion (RRF) for result merging
"""

import os
import logging
import hashlib
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class HybridSearchResult:
    """Result from hybrid search."""
    chunk_id: str
    file_id: str
    page_number: int
    content: str
    score: float
    doc_url: str = None
    original_filename: str = None
    status: str = 'active'
    metadata: Dict = None
    
    def to_dict(self) -> Dict:
        return {
            'chunk_id': self.chunk_id,
            'file_id': self.file_id,
            'page_number': self.page_number,
            'content': self.content,
            'score': self.score,
            'doc_url': self.doc_url,
            'original_filename': self.original_filename,
            'status': self.status,
            'metadata': self.metadata or {}
        }


class QdrantHybridSearchService:
    """
    Qdrant-based hybrid search service for documents.
    
    Features:
    - Dense vector search for semantic similarity
    - Sparse vector search (BM25) for keyword matching
    - Reciprocal Rank Fusion (RRF) for combining results
    - Per-page document chunks with rich metadata
    """
    
    # Collection names
    DOCUMENTS_COLLECTION = "document_chunks"
    
    # Vector dimensions
    DENSE_DIMENSION = 768  # Standard embedding dimension
    
    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.enabled = False
        self.client = None
        self._init_client()
        self._init_embedding_providers()
    
    def _init_client(self):
        """Initialize Qdrant client."""
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import (
                Distance, VectorParams, SparseVectorParams,
                Modifier
            )
            
            host = os.environ.get('QDRANT_HOST', 'localhost')
            port = int(os.environ.get('QDRANT_PORT', 6333))
            
            self.client = QdrantClient(host=host, port=port)
            self.enabled = True
            logger.info(f"Connected to Qdrant at {host}:{port}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant client: {e}")
            self.enabled = False
    
    def _init_embedding_providers(self):
        """Initialize embedding providers for dense and sparse vectors."""
        self.dense_provider = None
        self.sparse_provider = None
        
        # Dense embeddings - use sentence transformers or other provider
        try:
            from sentence_transformers import SentenceTransformer
            self.dense_model = SentenceTransformer('all-MiniLM-L6-v2')
            self.dense_provider = 'sentence-transformers'
            logger.info("Dense embeddings: sentence-transformers")
        except ImportError:
            logger.warning("sentence-transformers not available for dense embeddings")
            self.dense_model = None
        
        # Sparse embeddings (BM25) - use fastembed if available
        try:
            from fastembed import SparseTextEmbedding
            self.sparse_model = SparseTextEmbedding(model_name="Qdrant/bm25")
            self.sparse_provider = 'fastembed-bm25'
            logger.info("Sparse embeddings: fastembed BM25")
        except ImportError:
            logger.warning("fastembed not available, using simple TF-IDF for sparse vectors")
            self.sparse_model = None
            self.sparse_provider = 'tfidf'
    
    def ensure_collection(self):
        """Create or verify document chunks collection with hybrid vectors."""
        if not self.enabled:
            return False
        
        try:
            from qdrant_client.models import (
                Distance, VectorParams, SparseVectorParams,
                Modifier
            )
            
            collections = self.client.get_collections()
            collection_names = [c.name for c in collections.collections]
            
            if self.DOCUMENTS_COLLECTION not in collection_names:
                # Create collection with both dense and sparse vectors
                self.client.create_collection(
                    collection_name=self.DOCUMENTS_COLLECTION,
                    vectors_config={
                        "dense": VectorParams(
                            size=self.DENSE_DIMENSION,
                            distance=Distance.COSINE
                        )
                    },
                    sparse_vectors_config={
                        "sparse": SparseVectorParams(
                            modifier=Modifier.IDF  # Enable BM25-style IDF weighting
                        )
                    }
                )
                logger.info(f"Created collection: {self.DOCUMENTS_COLLECTION}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}")
            return False
    
    def _generate_point_id(self, chunk_id: str, org_id: int) -> str:
        """Generate unique point ID for Qdrant."""
        raw = f"{org_id}:{chunk_id}"
        return hashlib.md5(raw.encode()).hexdigest()
    
    def _get_dense_embedding(self, text: str) -> List[float]:
        """Generate dense embedding for text."""
        if self.dense_model is not None:
            embedding = self.dense_model.encode(text)
            return embedding.tolist()
        
        # Fallback: try Google Generative AI
        try:
            import google.generativeai as genai
            result = genai.embed_content(
                model="models/embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            logger.warning(f"Failed to generate dense embedding: {e}")
            return [0.0] * self.DENSE_DIMENSION
    
    def _get_sparse_embedding(self, text: str) -> Tuple[List[int], List[float]]:
        """Generate sparse (BM25/TF-IDF) embedding for text."""
        if self.sparse_model is not None:
            try:
                # FastEmbed sparse embedding
                embeddings = list(self.sparse_model.embed([text]))
                if embeddings:
                    sparse = embeddings[0]
                    return sparse.indices.tolist(), sparse.values.tolist()
            except Exception as e:
                logger.warning(f"FastEmbed sparse embedding failed: {e}")
        
        # Fallback: Simple TF-IDF-like sparse representation
        return self._simple_tfidf(text)
    
    def _simple_tfidf(self, text: str) -> Tuple[List[int], List[float]]:
        """Simple TF-IDF-like sparse representation as fallback."""
        import re
        from collections import Counter
        
        # Tokenize and count words
        words = re.findall(r'\b\w+\b', text.lower())
        word_counts = Counter(words)
        total_words = len(words)
        
        if total_words == 0:
            return [], []
        
        # Use word hash as index (simple approach)
        indices = []
        values = []
        for word, count in word_counts.items():
            # Hash word to get sparse index
            word_hash = hash(word) % 100000  # Limit to reasonable range
            tf = count / total_words
            indices.append(abs(word_hash))
            values.append(tf)
        
        return indices, values
    
    def upsert_document_chunk(
        self,
        chunk_id: str,
        file_id: str,
        page_number: int,
        content: str,
        org_id: int,
        doc_url: str = None,
        original_filename: str = None,
        status: str = 'active',
        metadata: Dict = None
    ) -> bool:
        """
        Store a document chunk with hybrid embeddings.
        
        Args:
            chunk_id: Unique chunk identifier
            file_id: Parent document ID
            page_number: Page/slide number
            content: Chunk text content
            org_id: Organization ID
            doc_url: Document storage URL
            original_filename: Original file name
            status: Chunk status (active/deleted)
            metadata: Additional metadata
            
        Returns:
            True if successful
        """
        if not self.enabled:
            return False
        
        self.ensure_collection()
        
        try:
            from qdrant_client.models import PointStruct, SparseVector
            
            # Generate embeddings
            dense_vector = self._get_dense_embedding(content)
            sparse_indices, sparse_values = self._get_sparse_embedding(content)
            
            # Build payload
            payload = {
                'chunk_id': chunk_id,
                'file_id': file_id,
                'page_number': page_number,
                'content': content[:5000],  # Limit content size
                'content_length': len(content),
                'org_id': org_id,
                'doc_url': doc_url or '',
                'original_filename': original_filename or '',
                'status': status,
                'indexed_at': datetime.utcnow().isoformat(),
                **(metadata or {})
            }
            
            # Create point with hybrid vectors
            point_id = self._generate_point_id(chunk_id, org_id)
            
            point = PointStruct(
                id=point_id,
                vector={
                    'dense': dense_vector,
                    'sparse': SparseVector(
                        indices=sparse_indices,
                        values=sparse_values
                    )
                },
                payload=payload
            )
            
            # Upsert to Qdrant
            self.client.upsert(
                collection_name=self.DOCUMENTS_COLLECTION,
                points=[point]
            )
            
            logger.debug(f"Indexed chunk {chunk_id} for file {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to upsert chunk {chunk_id}: {e}")
            return False
    
    def upsert_document_chunks(
        self,
        chunks: List,  # List of DocumentChunk from chunking service
        org_id: int
    ) -> int:
        """
        Bulk upsert document chunks.
        
        Returns:
            Number of successfully indexed chunks
        """
        if not self.enabled or not chunks:
            return 0
        
        self.ensure_collection()
        
        try:
            from qdrant_client.models import PointStruct, SparseVector
            
            points = []
            for chunk in chunks:
                # Generate embeddings
                dense_vector = self._get_dense_embedding(chunk.content)
                sparse_indices, sparse_values = self._get_sparse_embedding(chunk.content)
                
                # Build payload from chunk
                payload = chunk.to_qdrant_metadata(org_id)
                payload['content'] = chunk.content[:5000]
                payload['indexed_at'] = datetime.utcnow().isoformat()
                
                point_id = self._generate_point_id(chunk.chunk_id, org_id)
                
                point = PointStruct(
                    id=point_id,
                    vector={
                        'dense': dense_vector,
                        'sparse': SparseVector(
                            indices=sparse_indices,
                            values=sparse_values
                        )
                    },
                    payload=payload
                )
                points.append(point)
            
            # Batch upsert
            self.client.upsert(
                collection_name=self.DOCUMENTS_COLLECTION,
                points=points
            )
            
            logger.info(f"Indexed {len(points)} chunks for org {org_id}")
            return len(points)
            
        except Exception as e:
            logger.error(f"Failed to bulk upsert chunks: {e}")
            return 0
    
    def hybrid_search(
        self,
        query: str,
        org_id: int,
        limit: int = 10,
        file_id: str = None,
        score_threshold: float = 0.3,
        fusion_method: str = 'rrf'  # 'rrf' or 'dbsf'
    ) -> List[HybridSearchResult]:
        """
        Perform hybrid search using dense + sparse vectors.
        
        Uses Qdrant's query API with prefetch for efficient hybrid search.
        Results are fused using Reciprocal Rank Fusion (RRF).
        
        Args:
            query: Search query text
            org_id: Organization ID filter
            limit: Maximum results
            file_id: Optional specific document filter
            score_threshold: Minimum score threshold
            fusion_method: 'rrf' (Reciprocal Rank Fusion) or 'dbsf' (Distribution-Based Score Fusion)
            
        Returns:
            List of HybridSearchResult
        """
        if not self.enabled:
            return []
        
        try:
            from qdrant_client.models import (
                Filter, FieldCondition, MatchValue,
                Prefetch, FusionQuery, Fusion,
                SparseVector
            )
            
            # Generate query embeddings
            dense_query = self._get_dense_embedding(query)
            sparse_indices, sparse_values = self._get_sparse_embedding(query)
            
            # Build filter
            filter_conditions = [
                FieldCondition(
                    key="org_id",
                    match=MatchValue(value=org_id)
                ),
                FieldCondition(
                    key="status",
                    match=MatchValue(value="active")
                )
            ]
            
            if file_id:
                filter_conditions.append(
                    FieldCondition(
                        key="file_id",
                        match=MatchValue(value=file_id)
                    )
                )
            
            query_filter = Filter(must=filter_conditions)
            
            # Use Qdrant's query API with prefetch for hybrid search
            # Prefetch from both dense and sparse, then fuse
            results = self.client.query_points(
                collection_name=self.DOCUMENTS_COLLECTION,
                prefetch=[
                    Prefetch(
                        query=dense_query,
                        using="dense",
                        limit=limit * 2
                    ),
                    Prefetch(
                        query=SparseVector(
                            indices=sparse_indices,
                            values=sparse_values
                        ),
                        using="sparse",
                        limit=limit * 2
                    )
                ],
                query=FusionQuery(fusion=Fusion.RRF),
                filter=query_filter,
                limit=limit,
                with_payload=True
            )
            
            # Convert to results
            search_results = []
            for point in results.points:
                if point.score >= score_threshold:
                    payload = point.payload or {}
                    search_results.append(HybridSearchResult(
                        chunk_id=payload.get('chunk_id', ''),
                        file_id=payload.get('file_id', ''),
                        page_number=payload.get('page_number', 0),
                        content=payload.get('content', ''),
                        score=point.score,
                        doc_url=payload.get('doc_url'),
                        original_filename=payload.get('original_filename'),
                        status=payload.get('status', 'active'),
                        metadata={
                            k: v for k, v in payload.items()
                            if k not in ['chunk_id', 'file_id', 'page_number', 'content', 'doc_url', 'original_filename', 'status']
                        }
                    ))
            
            logger.debug(f"Hybrid search returned {len(search_results)} results for query: {query[:50]}...")
            return search_results
            
        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            # Fallback to simple dense search
            return self._fallback_dense_search(query, org_id, limit, file_id, score_threshold)
    
    def _fallback_dense_search(
        self,
        query: str,
        org_id: int,
        limit: int,
        file_id: str,
        score_threshold: float
    ) -> List[HybridSearchResult]:
        """Fallback to simple dense vector search if hybrid fails."""
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            
            dense_query = self._get_dense_embedding(query)
            
            filter_conditions = [
                FieldCondition(key="org_id", match=MatchValue(value=org_id)),
                FieldCondition(key="status", match=MatchValue(value="active"))
            ]
            if file_id:
                filter_conditions.append(
                    FieldCondition(key="file_id", match=MatchValue(value=file_id))
                )
            
            results = self.client.search(
                collection_name=self.DOCUMENTS_COLLECTION,
                query_vector=("dense", dense_query),
                query_filter=Filter(must=filter_conditions),
                limit=limit,
                with_payload=True,
                score_threshold=score_threshold
            )
            
            search_results = []
            for point in results:
                payload = point.payload or {}
                search_results.append(HybridSearchResult(
                    chunk_id=payload.get('chunk_id', ''),
                    file_id=payload.get('file_id', ''),
                    page_number=payload.get('page_number', 0),
                    content=payload.get('content', ''),
                    score=point.score,
                    doc_url=payload.get('doc_url'),
                    original_filename=payload.get('original_filename'),
                    status=payload.get('status', 'active'),
                    metadata={}
                ))
            
            return search_results
            
        except Exception as e:
            logger.error(f"Fallback dense search failed: {e}")
            return []
    
    def delete_document_chunks(self, file_id: str, org_id: int) -> bool:
        """Delete all chunks for a document."""
        if not self.enabled:
            return False
        
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            
            self.client.delete(
                collection_name=self.DOCUMENTS_COLLECTION,
                points_selector=Filter(
                    must=[
                        FieldCondition(key="file_id", match=MatchValue(value=file_id)),
                        FieldCondition(key="org_id", match=MatchValue(value=org_id))
                    ]
                )
            )
            
            logger.info(f"Deleted chunks for file {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete chunks for {file_id}: {e}")
            return False
    
    def get_document_chunks(
        self,
        file_id: str,
        org_id: int,
        limit: int = 100
    ) -> List[HybridSearchResult]:
        """Get all chunks for a specific document."""
        if not self.enabled:
            return []
        
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            
            results, _ = self.client.scroll(
                collection_name=self.DOCUMENTS_COLLECTION,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(key="file_id", match=MatchValue(value=file_id)),
                        FieldCondition(key="org_id", match=MatchValue(value=org_id))
                    ]
                ),
                limit=limit,
                with_payload=True
            )
            
            chunks = []
            for point in results:
                payload = point.payload or {}
                chunks.append(HybridSearchResult(
                    chunk_id=payload.get('chunk_id', ''),
                    file_id=payload.get('file_id', ''),
                    page_number=payload.get('page_number', 0),
                    content=payload.get('content', ''),
                    score=1.0,
                    doc_url=payload.get('doc_url'),
                    original_filename=payload.get('original_filename'),
                    status=payload.get('status', 'active'),
                    metadata={}
                ))
            
            return sorted(chunks, key=lambda x: x.page_number)
            
        except Exception as e:
            logger.error(f"Failed to get chunks for {file_id}: {e}")
            return []


# Singleton instance
_hybrid_search_instance: Dict[int, QdrantHybridSearchService] = {}


def get_hybrid_search_service(org_id: int = None) -> QdrantHybridSearchService:
    """Get hybrid search service instance for an organization."""
    global _hybrid_search_instance
    
    key = org_id or 0
    if key not in _hybrid_search_instance:
        _hybrid_search_instance[key] = QdrantHybridSearchService(org_id)
    
    return _hybrid_search_instance[key]
