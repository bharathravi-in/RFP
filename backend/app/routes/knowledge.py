from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import KnowledgeItem, User
from ..services.qdrant_service import get_qdrant_service
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('knowledge', __name__)


def _try_async_embedding(item_id: int, org_id: int, action: str = 'create'):
    """Try to use async Celery task, fallback to sync if unavailable."""
    try:
        if action == 'create':
            from ..tasks import create_embedding_task
            create_embedding_task.delay(item_id, org_id)
            logger.info(f"Queued async embedding task for item {item_id}")
        elif action == 'delete':
            from ..tasks import delete_embedding_task
            delete_embedding_task.delay(item_id, org_id)
            logger.info(f"Queued async delete task for item {item_id}")
        return True
    except Exception as e:
        logger.warning(f"Async task failed, using sync: {e}")
        return False


@bp.route('', methods=['GET'])
@jwt_required()
def list_knowledge():
    """List knowledge base items."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    # Filter options
    tag = request.args.get('tag')
    source_type = request.args.get('source_type')
    search = request.args.get('search')
    
    query = KnowledgeItem.query.filter_by(
        organization_id=user.organization_id,
        is_active=True
    )
    
    if tag:
        query = query.filter(KnowledgeItem.tags.contains([tag]))
    
    if source_type:
        query = query.filter_by(source_type=source_type)
    
    if search:
        query = query.filter(
            db.or_(
                KnowledgeItem.title.ilike(f'%{search}%'),
                KnowledgeItem.content.ilike(f'%{search}%')
            )
        )
    
    items = query.order_by(KnowledgeItem.updated_at.desc()).all()
    
    return jsonify({
        'items': [item.to_dict() for item in items]
    }), 200


@bp.route('', methods=['POST'])
@jwt_required()
def create_knowledge():
    """Create a knowledge base item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    
    if not data.get('title') or not data.get('content'):
        return jsonify({'error': 'Title and content required'}), 400
    
    item = KnowledgeItem(
        title=data['title'],
        content=data['content'],
        tags=data.get('tags', []),
        source_type='manual',
        organization_id=user.organization_id,
        created_by=user_id
    )
    
    db.session.add(item)
    db.session.commit()
    
    # Create embedding in Qdrant (async with sync fallback)
    if not _try_async_embedding(item.id, user.organization_id, 'create'):
        # Sync fallback
        try:
            qdrant = get_qdrant_service()
            if qdrant.enabled:
                embedding_id = qdrant.upsert_item(
                    item_id=item.id,
                    org_id=user.organization_id,
                    title=item.title,
                    content=item.content,
                    folder_id=item.folder_id,
                    tags=item.tags or []
                )
                if embedding_id:
                    item.embedding_id = embedding_id
                    db.session.commit()
                    logger.info(f"Created embedding for knowledge item {item.id}")
        except Exception as e:
            logger.error(f"Failed to create embedding: {e}")
    
    return jsonify({
        'message': 'Knowledge item created',
        'item': item.to_dict()
    }), 201


@bp.route('/<int:item_id>', methods=['GET'])
@jwt_required()
def get_knowledge(item_id):
    """Get knowledge item details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'item': item.to_dict()
    }), 200


@bp.route('/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_knowledge(item_id):
    """Update a knowledge item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    content_changed = False
    if 'title' in data:
        item.title = data['title']
        content_changed = True
    if 'content' in data:
        item.content = data['content']
        content_changed = True
    if 'tags' in data:
        item.tags = data['tags']
    if 'is_active' in data:
        item.is_active = data['is_active']
    
    db.session.commit()
    
    # Re-create embedding if content changed (async with sync fallback)
    if content_changed:
        if not _try_async_embedding(item.id, user.organization_id, 'create'):
            # Sync fallback
            try:
                qdrant = get_qdrant_service()
                if qdrant.enabled:
                    embedding_id = qdrant.upsert_item(
                        item_id=item.id,
                        org_id=user.organization_id,
                        title=item.title,
                        content=item.content,
                        folder_id=item.folder_id,
                        tags=item.tags or []
                    )
                    if embedding_id:
                        item.embedding_id = embedding_id
                        db.session.commit()
                        logger.info(f"Updated embedding for knowledge item {item.id}")
            except Exception as e:
                logger.error(f"Failed to update embedding: {e}")
    
    return jsonify({
        'message': 'Knowledge item updated',
        'item': item.to_dict()
    }), 200


@bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_knowledge(item_id):
    """Delete a knowledge item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Soft delete
    item.is_active = False
    db.session.commit()
    
    # Remove from Qdrant (async with sync fallback)
    if not _try_async_embedding(item.id, user.organization_id, 'delete'):
        # Sync fallback
        try:
            qdrant = get_qdrant_service()
            if qdrant.enabled:
                qdrant.delete_item(item_id=item.id, org_id=user.organization_id)
                logger.info(f"Deleted embedding for knowledge item {item.id}")
        except Exception as e:
            logger.error(f"Failed to delete embedding: {e}")
    
    return jsonify({'message': 'Knowledge item deleted'}), 200


@bp.route('/import', methods=['POST'])
@jwt_required()
def import_csv():
    """Import Q&A pairs from CSV."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    # TODO: Parse CSV and create items
    # from ..services.knowledge_service import import_csv_file
    # count = import_csv_file(file, user.organization_id, user_id)
    
    return jsonify({
        'message': 'Import started',
        'status': 'processing'
    }), 202


@bp.route('/reindex', methods=['POST'])
@jwt_required()
def reindex_knowledge():
    """Trigger re-indexing of all knowledge items."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    # Reindex all knowledge items in Qdrant
    try:
        qdrant = get_qdrant_service()
        if not qdrant.enabled:
            return jsonify({
                'error': 'Qdrant service not available',
                'status': 'failed'
            }), 503
        
        # Fetch all active items for the organization
        items = KnowledgeItem.query.filter_by(
            organization_id=user.organization_id,
            is_active=True
        ).all()
        
        # Convert to list of dicts for reindexing
        items_data = [{
            'id': item.id,
            'title': item.title,
            'content': item.content,
            'folder_id': item.folder_id,
            'tags': item.tags or []
        } for item in items]
        
        count = qdrant.reindex_all(items=items_data, org_id=user.organization_id)
        
        logger.info(f"Reindexed {count} items for org {user.organization_id}")
        
        return jsonify({
            'message': f'Reindexed {count} items',
            'count': count,
            'status': 'completed'
        }), 200
    except Exception as e:
        logger.error(f"Reindex failed: {e}")
        return jsonify({
            'error': str(e),
            'status': 'failed'
        }), 500


@bp.route('/search', methods=['POST'])
@jwt_required()
def search_knowledge():
    """Semantic search in knowledge base."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    data = request.get_json()
    query = data.get('query')
    limit = data.get('limit', 5)
    
    if not query:
        return jsonify({'error': 'Search query required'}), 400
    
    # Semantic search with Qdrant
    try:
        qdrant = get_qdrant_service()
        if qdrant.enabled:
            qdrant_results = qdrant.search(
                query=query,
                org_id=user.organization_id,
                limit=limit
            )
            
            if qdrant_results:
                # Fetch full items from database
                item_ids = [r['item_id'] for r in qdrant_results]
                items_map = {item.id: item for item in KnowledgeItem.query.filter(
                    KnowledgeItem.id.in_(item_ids)
                ).all()}
                
                results = []
                for r in qdrant_results:
                    item = items_map.get(r['item_id'])
                    if item:
                        results.append({
                            'item': item.to_dict(),
                            'score': r['score']
                        })
                
                return jsonify({'results': results}), 200
    except Exception as e:
        logger.error(f"Qdrant search failed, falling back to SQL: {e}")
    
    # Fallback - basic text search
    items = KnowledgeItem.query.filter(
        KnowledgeItem.organization_id == user.organization_id,
        KnowledgeItem.is_active == True,
        db.or_(
            KnowledgeItem.title.ilike(f'%{query}%'),
            KnowledgeItem.content.ilike(f'%{query}%')
        )
    ).limit(limit).all()
    
    return jsonify({
        'results': [{
            'item': item.to_dict(),
            'score': 0.9  # Placeholder relevance score
        } for item in items]
    }), 200
