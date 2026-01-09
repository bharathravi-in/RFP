"""
Index Knowledge Items using Sentence Transformers (Local, No API Key Required)

Uses the same embedding model as hybrid_search_service.py: all-MiniLM-L6-v2
"""
from app import create_app
from app.models import KnowledgeItem, Organization
from app.extensions import db
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
import hashlib
import os


def index_knowledge_items():
    """Index all knowledge items using local sentence-transformers."""
    app = create_app()
    
    with app.app_context():
        # Get organization
        org = Organization.query.first()
        if not org:
            print('❌ No organization found!')
            return
        
        print(f'Organization: {org.name} (ID: {org.id})')
        
        # Initialize sentence transformer model (same as hybrid_search_service)
        print('Loading sentence-transformers model...')
        model = SentenceTransformer('all-MiniLM-L6-v2')
        print(f'✅ Loaded model: all-MiniLM-L6-v2 (embedding dim: 384)')
        
        # Connect to Qdrant
        host = os.environ.get('QDRANT_HOST', 'qdrant')
        port = int(os.environ.get('QDRANT_PORT', 6333))
        client = QdrantClient(host=host, port=port)
        print(f'✅ Connected to Qdrant at {host}:{port}')
        
        # Ensure collection exists with correct dimension (384 for MiniLM)
        COLLECTION_NAME = "knowledge_base"
        EMBEDDING_DIM = 384  # MiniLM-L6-v2 dimension
        
        collections = client.get_collections().collections
        exists = any(c.name == COLLECTION_NAME for c in collections)
        
        if exists:
            # Check if dimension matches
            info = client.get_collection(COLLECTION_NAME)
            current_dim = info.config.params.vectors.size
            if current_dim != EMBEDDING_DIM:
                print(f'⚠️  Collection exists with dimension {current_dim}, need {EMBEDDING_DIM}. Recreating...')
                client.delete_collection(COLLECTION_NAME)
                exists = False
        
        if not exists:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=EMBEDDING_DIM,
                    distance=Distance.COSINE
                )
            )
            print(f'✅ Created collection: {COLLECTION_NAME} (dim: {EMBEDDING_DIM})')
        else:
            print(f'✅ Collection exists: {COLLECTION_NAME}')
        
        # Get knowledge items for org 1 first (main org based on data)
        items = KnowledgeItem.query.filter_by(
            organization_id=1,  # Start with main org
            is_active=True
        ).all()
        
        if not items:
            # Try org 14 
            items = KnowledgeItem.query.filter_by(
                organization_id=org.id,
                is_active=True
            ).all()
        
        print(f'\nIndexing {len(items)} knowledge items...\n')
        
        indexed_count = 0
        error_count = 0
        
        for i, item in enumerate(items, 1):
            try:
                title_preview = item.title[:50] + '...' if len(item.title) > 50 else item.title
                print(f'[{i}/{len(items)}] {title_preview}', end='', flush=True)
                
                # Generate embedding using sentence-transformers
                text_to_embed = f"{item.title}\n\n{item.content}"[:8000]  # Limit text length
                embedding = model.encode(text_to_embed).tolist()
                
                # Generate point ID
                point_id = hashlib.md5(f"{item.organization_id}:{item.id}".encode()).hexdigest()
                
                # Build payload
                payload = {
                    "item_id": item.id,
                    "org_id": item.organization_id,
                    "title": item.title,
                    "content_preview": (item.content or '')[:500],
                    "folder_id": item.folder_id,
                    "tags": item.tags or [],
                    "knowledge_profile_id": item.knowledge_profile_id,
                }
                
                # Upsert to Qdrant
                client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=[
                        PointStruct(
                            id=point_id,
                            vector=embedding,
                            payload=payload
                        )
                    ]
                )
                
                # Update embedding_id in database
                item.embedding_id = point_id
                indexed_count += 1
                print(f' ✅')
                
                # Commit every 50 items
                if indexed_count % 50 == 0:
                    db.session.commit()
                    print(f'--- Committed {indexed_count} items ---')
                    
            except Exception as e:
                error_count += 1
                print(f' ❌ Error: {str(e)[:80]}')
        
        db.session.commit()
        print('\n' + '=' * 60)
        print(f'✅ Successfully indexed {indexed_count}/{len(items)} items')
        if error_count > 0:
            print(f'❌ {error_count} errors')
        
        # Verify in Qdrant
        info = client.get_collection(COLLECTION_NAME)
        print(f'\nQdrant collection info:')
        print(f'  Points: {info.points_count}')


if __name__ == '__main__':
    index_knowledge_items()
