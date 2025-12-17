"""
Index Knowledge Items in Qdrant

Indexes all active knowledge items using the configured embedding provider.
"""
from app import create_app
from app.models import KnowledgeItem, Organization, OrganizationAIConfig
from app.services.qdrant_service import get_qdrant_service
from app.extensions import db
import os


def index_knowledge_items():
    """Index all knowledge items."""
    app = create_app()
    
    with app.app_context():
        # Update config with new API key first
        config = OrganizationAIConfig.query.first()
        if config:
            config.embedding_provider = 'google'
            config.embedding_model = 'models/text-embedding-004'
            config.embedding_dimension = 768
            new_key = os.getenv('GOOGLE_API_KEY')
            if new_key:
                config.set_embedding_key(new_key)
                db.session.commit()
                print(f'✅ Updated config with new API key\n')
        
        # Get organization
        org = Organization.query.first()
        print(f'Organization: {org.name} (ID: {org.id})')
        
        # Get Qdrant service with org_id
        qdrant = get_qdrant_service(org_id=org.id)
        
        if not qdrant.enabled:
            print('❌ Qdrant is not enabled!')
            return
        
        provider_name = qdrant.embedding_provider.provider_name if qdrant.embedding_provider else 'None'
        print(f'Provider: {provider_name}')
        if qdrant.embedding_provider:
            print(f'Model: {qdrant.embedding_provider.model}')
        print()
        
        # Get knowledge items
        items = KnowledgeItem.query.filter_by(is_active=True).all()
        print(f'Indexing {len(items)} knowledge items...\n')
        
        indexed_count = 0
        for i, item in enumerate(items, 1):
            try:
                title_preview = item.title[:50] + '...' if len(item.title) > 50 else item.title
                print(f'[{i}/{len(items)}] {title_preview}')
                
                embedding_id = qdrant.upsert_item(
                    item_id=item.id,
                    org_id=item.organization_id,
                    title=item.title,
                    content=item.content,
                    folder_id=item.folder_id,
                    tags=item.tags or []
                )
                
                item.embedding_id = embedding_id
                indexed_count += 1
                print(f'      ✅ Indexed (ID: {embedding_id[:16]}...)\n')
            except Exception as e:
                print(f'      ❌ Error: {str(e)}\n')
        
        db.session.commit()
        print('=' * 60)
        print(f'✅ Successfully indexed {indexed_count}/{len(items)} items\n')
        
        # Test search
        if indexed_count > 0:
            print('Testing semantic search...')
            results = qdrant.search(query='technical architecture', org_id=org.id, limit=3)
            print(f'Found {len(results)} results:\n')
            for r in results:
                print(f'  📄 {r.get("title")}')
                print(f'     Score: {r.get("score"):.4f}\n')


if __name__ == '__main__':
    index_knowledge_items()
