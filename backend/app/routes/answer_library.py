"""
Answer Library routes for managing reusable Q&A repository.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import AnswerLibraryItem, Question, Answer, User
from ..services.library_service import library_service


bp = Blueprint('answer_library', __name__)


@bp.route('/list', methods=['GET'])
@jwt_required()
def list_library_items():
    """List all library items for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'items': []}), 200
    
    # Optional filters
    category = request.args.get('category')
    tag = request.args.get('tag')
    search = request.args.get('search', '').lower()
    
    query = AnswerLibraryItem.query.filter_by(
        organization_id=user.organization_id,
        is_active=True
    )
    
    if category:
        query = query.filter_by(category=category)
    
    if search:
        query = query.filter(
            db.or_(
                AnswerLibraryItem.question_text.ilike(f'%{search}%'),
                AnswerLibraryItem.answer_text.ilike(f'%{search}%'),
            )
        )
    
    # Order by usage (most helpful first)
    items = query.order_by(
        AnswerLibraryItem.times_used.desc(),
        AnswerLibraryItem.updated_at.desc()
    ).all()
    
    # Filter by tag if specified
    if tag:
        items = [i for i in items if tag in (i.tags or [])]
    
    return jsonify({
        'items': [item.to_dict() for item in items],
        'total': len(items),
    })


@bp.route('/<int:item_id>', methods=['GET'])
@jwt_required()
def get_library_item(item_id):
    """Get a specific library item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = AnswerLibraryItem.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({'item': item.to_dict()})


@bp.route('', methods=['POST'])
@jwt_required()
def create_library_item():
    """Create a new library item (manually or from answer)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 400
    
    data = request.get_json()
    
    # Required fields
    question_text = data.get('question_text', '').strip()
    answer_text = data.get('answer_text', '').strip()
    
    if not question_text or not answer_text:
        return jsonify({'error': 'Question and answer text required'}), 400
    
    # Auto-generate tags if none provided
    tags = data.get('tags', [])
    auto_generated_tags = False
    if not tags:
        try:
            from ..services.tagging_service import get_tagging_service
            tagging_service = get_tagging_service(org_id=user.organization_id)
            tags = tagging_service.generate_tags(
                question=question_text,
                answer=answer_text,
                existing_category=data.get('category')
            )
            auto_generated_tags = True
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Auto-tagging failed: {e}")
    
    item = library_service.promote_to_library(
        question_text=question_text,
        answer_text=answer_text,
        organization_id=user.organization_id,
        user_id=user_id,
        category=data.get('category'),
        tags=tags,
        source_project_id=data.get('source_project_id'),
        source_question_id=data.get('source_question_id'),
        source_answer_id=data.get('source_answer_id'),
        status=data.get('status', 'under_review')
    )
    
    return jsonify({
        'message': 'Answer saved to library',
        'item': item.to_dict(),
        'auto_generated_tags': auto_generated_tags,
    }), 201


@bp.route('/from-answer/<int:answer_id>', methods=['POST'])
@jwt_required()
def save_answer_to_library(answer_id):
    """Save an approved answer to the library."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    answer = Answer.query.get(answer_id)
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    question = answer.question
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    project = question.project
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Check if already in library
    existing = AnswerLibraryItem.query.filter_by(
        source_answer_id=answer_id,
        is_active=True,
    ).first()
    
    if existing:
        return jsonify({
            'message': 'Answer already in library',
            'item': existing.to_dict(),
        }), 200
    
    data = request.get_json() or {}
    
    # Auto-generate tags if none provided
    tags = data.get('tags', [])
    auto_generated_tags = False
    if not tags:
        try:
            from ..services.tagging_service import get_tagging_service
            tagging_service = get_tagging_service(org_id=user.organization_id)
            tags = tagging_service.generate_tags(
                question=question.text,
                answer=answer.content,
                existing_category=question.category
            )
            auto_generated_tags = True
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Auto-tagging failed: {e}")
    
    item = library_service.promote_to_library(
        question_text=question.text,
        answer_text=answer.content,
        organization_id=user.organization_id,
        user_id=user_id,
        category=question.category or data.get('category'),
        tags=tags,
        source_project_id=project.id,
        source_question_id=question.id,
        source_answer_id=answer.id,
        status='under_review'
    )
    
    return jsonify({
        'message': 'Answer promoted to library (Under Review)',
        'item': item.to_dict(),
        'auto_generated_tags': auto_generated_tags,
    }), 201


@bp.route('/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_library_item(item_id):
    """Update a library item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = AnswerLibraryItem.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    item = library_service.update_item(item_id, data, user_id)
    
    if not item:
        return jsonify({'error': 'Failed to update item'}), 500
    
    return jsonify({
        'message': 'Library item updated',
        'item': item.to_dict(),
    })


@bp.route('/<int:item_id>/approve', methods=['POST'])
@jwt_required()
def approve_library_item(item_id):
    """Approve a library item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = AnswerLibraryItem.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
        
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
        
    # Check if user is admin or reviewer
    if user.role not in ['admin', 'reviewer']:
        return jsonify({'error': 'Unauthorized to approve items'}), 403
        
    item = library_service.approve_item(item_id, user_id)
    
    return jsonify({
        'message': 'Library item approved',
        'item': item.to_dict(),
    })


@bp.route('/<int:item_id>/archive', methods=['POST'])
@jwt_required()
def archive_library_item(item_id):
    """Archive a library item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = AnswerLibraryItem.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
        
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
        
    success = library_service.archive_item(item_id)
    
    if not success:
        return jsonify({'error': 'Failed to archive item'}), 500
        
    return jsonify({'message': 'Library item archived'})


@bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_library_item(item_id):
    """Soft delete a library item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = AnswerLibraryItem.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Soft delete
    item.is_active = False
    item.updated_by = user_id
    
    db.session.commit()
    
    return jsonify({'message': 'Library item deleted'})


@bp.route('/search', methods=['POST'])
@jwt_required()
def search_library():
    """Search library for similar questions (for suggestions)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'items': []}), 200
    
    data = request.get_json()
    query_text = data.get('query', '').lower()
    category = data.get('category')
    limit = data.get('limit', 5)
    
    if not query_text:
        return jsonify({'items': []}), 200
    
    # Basic text search (could be enhanced with vector similarity)
    items = AnswerLibraryItem.query.filter(
        AnswerLibraryItem.organization_id == user.organization_id,
        AnswerLibraryItem.is_active == True,
        db.or_(
            AnswerLibraryItem.question_text.ilike(f'%{query_text}%'),
            AnswerLibraryItem.answer_text.ilike(f'%{query_text}%'),
        )
    )
    
    if category:
        items = items.filter(AnswerLibraryItem.category == category)
    
    items = items.order_by(
        AnswerLibraryItem.times_helpful.desc(),
        AnswerLibraryItem.times_used.desc(),
    ).limit(limit).all()
    
    return jsonify({
        'items': [item.to_dict() for item in items],
        'total': len(items),
    })


@bp.route('/<int:item_id>/use', methods=['POST'])
@jwt_required()
def record_usage(item_id):
    """Record that a library item was used."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = AnswerLibraryItem.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    helpful = data.get('helpful', True)
    
    item.times_used += 1
    if helpful:
        item.times_helpful += 1
    
    db.session.commit()
    
    return jsonify({
        'message': 'Usage recorded',
        'times_used': item.times_used,
        'times_helpful': item.times_helpful,
    })


@bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Get list of unique categories in the library."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'categories': []}), 200
    
    categories = db.session.query(AnswerLibraryItem.category).filter(
        AnswerLibraryItem.organization_id == user.organization_id,
        AnswerLibraryItem.is_active == True,
        AnswerLibraryItem.category.isnot(None),
    ).distinct().all()
    
    return jsonify({
        'categories': sorted([c[0] for c in categories if c[0]])
    })


@bp.route('/suggested-tags', methods=['GET'])
@jwt_required()
def get_suggested_tags():
    """Get tag suggestions based on partial text."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'tags': []}), 200
    
    partial = request.args.get('text', '').strip()
    limit = request.args.get('limit', 10, type=int)
    
    try:
        from ..services.tagging_service import get_tagging_service
        tagging_service = get_tagging_service(org_id=user.organization_id)
        tags = tagging_service.suggest_tags(partial, limit=limit)
        return jsonify({'tags': tags})
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Tag suggestion failed: {e}")
        return jsonify({'tags': []})


@bp.route('/all-tags', methods=['GET'])
@jwt_required()
def get_all_tags():
    """Get all unique tags used in the library with counts."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'tags': []}), 200
    
    items = AnswerLibraryItem.query.filter_by(
        organization_id=user.organization_id,
        is_active=True
    ).all()
    
    # Count tag occurrences
    tag_counts = {}
    for item in items:
        for tag in (item.tags or []):
            tag_lower = tag.lower()
            tag_counts[tag_lower] = tag_counts.get(tag_lower, 0) + 1
    
    # Sort by count descending
    sorted_tags = sorted(
        tag_counts.items(),
        key=lambda x: (-x[1], x[0])
    )
    
    return jsonify({
        'tags': [{'tag': tag, 'count': count} for tag, count in sorted_tags]
    })
