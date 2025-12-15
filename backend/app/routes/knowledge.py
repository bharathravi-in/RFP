from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import KnowledgeItem, User

bp = Blueprint('knowledge', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def list_knowledge():
    """List knowledge base items."""
    user_id = get_jwt_identity()
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
    user_id = get_jwt_identity()
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
    
    # TODO: Create embedding in Qdrant
    # from ..services.knowledge_service import create_embedding
    # item.embedding_id = create_embedding(item.content)
    # db.session.commit()
    
    return jsonify({
        'message': 'Knowledge item created',
        'item': item.to_dict()
    }), 201


@bp.route('/<int:item_id>', methods=['GET'])
@jwt_required()
def get_knowledge(item_id):
    """Get knowledge item details."""
    user_id = get_jwt_identity()
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
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'title' in data:
        item.title = data['title']
    if 'content' in data:
        item.content = data['content']
        # TODO: Re-create embedding
    if 'tags' in data:
        item.tags = data['tags']
    if 'is_active' in data:
        item.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Knowledge item updated',
        'item': item.to_dict()
    }), 200


@bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_knowledge(item_id):
    """Delete a knowledge item."""
    user_id = get_jwt_identity()
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
    
    # TODO: Remove from Qdrant
    
    return jsonify({'message': 'Knowledge item deleted'}), 200


@bp.route('/import', methods=['POST'])
@jwt_required()
def import_csv():
    """Import Q&A pairs from CSV."""
    user_id = get_jwt_identity()
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
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    # TODO: Trigger async reindex task
    # from ..tasks import reindex_knowledge_base
    # reindex_knowledge_base.delay(user.organization_id)
    
    return jsonify({
        'message': 'Reindex started',
        'status': 'processing'
    }), 202


@bp.route('/search', methods=['POST'])
@jwt_required()
def search_knowledge():
    """Semantic search in knowledge base."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    data = request.get_json()
    query = data.get('query')
    limit = data.get('limit', 5)
    
    if not query:
        return jsonify({'error': 'Search query required'}), 400
    
    # TODO: Semantic search with Qdrant
    # from ..services.knowledge_service import semantic_search
    # results = semantic_search(query, user.organization_id, limit)
    
    # Placeholder - basic text search
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
