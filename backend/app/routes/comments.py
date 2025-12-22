"""
Comments routes for inline comments and @mentions.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import Comment, User, Notification, RFPSection, Question, Answer

bp = Blueprint('comments', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def list_comments():
    """List comments for a specific target (section, question, or answer)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'comments': []}), 200
    
    # Get target type and ID from query params
    section_id = request.args.get('section_id', type=int)
    question_id = request.args.get('question_id', type=int)
    answer_id = request.args.get('answer_id', type=int)
    include_resolved = request.args.get('include_resolved', 'true').lower() == 'true'
    
    query = Comment.query.filter_by(
        organization_id=user.organization_id,
        parent_id=None  # Only top-level comments
    )
    
    if section_id:
        query = query.filter_by(section_id=section_id)
    elif question_id:
        query = query.filter_by(question_id=question_id)
    elif answer_id:
        query = query.filter_by(answer_id=answer_id)
    else:
        return jsonify({'error': 'Must specify section_id, question_id, or answer_id'}), 400
    
    if not include_resolved:
        query = query.filter_by(resolved=False)
    
    comments = query.order_by(Comment.created_at.desc()).all()
    
    return jsonify({
        'comments': [c.to_dict() for c in comments],
        'total': len(comments)
    })


@bp.route('', methods=['POST'])
@jwt_required()
def create_comment():
    """Create a new comment with optional @mentions."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 400
    
    data = request.get_json()
    content = data.get('content', '').strip()
    
    if not content:
        return jsonify({'error': 'Comment content is required'}), 400
    
    # Determine target
    section_id = data.get('section_id')
    question_id = data.get('question_id')
    answer_id = data.get('answer_id')
    parent_id = data.get('parent_id')
    
    if not any([section_id, question_id, answer_id]):
        return jsonify({'error': 'Must specify a target (section_id, question_id, or answer_id)'}), 400
    
    # Extract @mentions from content
    mentioned_users = _extract_mentions(content, user.organization_id)
    
    comment = Comment(
        organization_id=user.organization_id,
        section_id=section_id,
        question_id=question_id,
        answer_id=answer_id,
        parent_id=parent_id,
        content=content,
        mentioned_users=[u.id for u in mentioned_users],
        created_by=user_id
    )
    
    db.session.add(comment)
    db.session.flush()  # Get comment ID
    
    # Create notifications for mentioned users
    for mentioned_user in mentioned_users:
        if mentioned_user.id != user_id:  # Don't notify yourself
            notification = Notification(
                user_id=mentioned_user.id,
                organization_id=user.organization_id,
                type='mention',
                title=f'{user.name} mentioned you',
                message=content[:100] + ('...' if len(content) > 100 else ''),
                related_id=comment.id,
                related_type='comment'
            )
            db.session.add(notification)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Comment created',
        'comment': comment.to_dict(),
        'mentions_notified': len(mentioned_users)
    }), 201


@bp.route('/<int:comment_id>', methods=['PUT'])
@jwt_required()
def update_comment(comment_id):
    """Update a comment's content."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    if comment.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Only creator can edit
    if comment.created_by != user_id:
        return jsonify({'error': 'Only the author can edit this comment'}), 403
    
    data = request.get_json()
    
    if 'content' in data:
        comment.content = data['content'].strip()
        # Re-extract mentions
        mentioned_users = _extract_mentions(comment.content, user.organization_id)
        comment.mentioned_users = [u.id for u in mentioned_users]
    
    db.session.commit()
    
    return jsonify({
        'message': 'Comment updated',
        'comment': comment.to_dict()
    })


@bp.route('/<int:comment_id>/resolve', methods=['PUT'])
@jwt_required()
def resolve_comment(comment_id):
    """Mark a comment as resolved or unresolved."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    if comment.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    resolved = data.get('resolved', True)
    
    comment.resolved = resolved
    if resolved:
        comment.resolved_by = user_id
        comment.resolved_at = datetime.utcnow()
    else:
        comment.resolved_by = None
        comment.resolved_at = None
    
    db.session.commit()
    
    return jsonify({
        'message': f'Comment {"resolved" if resolved else "reopened"}',
        'comment': comment.to_dict()
    })


@bp.route('/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    """Delete a comment."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    if comment.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Only creator or admin can delete
    if comment.created_by != user_id and user.role != 'admin':
        return jsonify({'error': 'Only the author or admin can delete this comment'}), 403
    
    # Delete replies first
    Comment.query.filter_by(parent_id=comment_id).delete()
    
    db.session.delete(comment)
    db.session.commit()
    
    return jsonify({'message': 'Comment deleted'})


@bp.route('/users-for-mention', methods=['GET'])
@jwt_required()
def users_for_mention():
    """Get users that can be mentioned (for autocomplete)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'users': []}), 200
    
    search = request.args.get('search', '').lower()
    
    query = User.query.filter_by(organization_id=user.organization_id)
    
    if search:
        query = query.filter(
            db.or_(
                User.name.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%')
            )
        )
    
    users = query.limit(10).all()
    
    return jsonify({
        'users': [{
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'avatar': u.profile_photo
        } for u in users]
    })


def _extract_mentions(content: str, org_id: int):
    """Extract mentioned users from content containing @username patterns."""
    import re
    
    # Find all @mentions
    mentions = re.findall(r'@(\w+)', content)
    
    if not mentions:
        return []
    
    # Find users matching the mentions
    users = User.query.filter(
        User.organization_id == org_id,
        User.name.in_(mentions)
    ).all()
    
    return users
