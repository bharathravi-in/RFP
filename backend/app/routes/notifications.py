"""
Notifications API routes.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import User, Notification

bp = Blueprint('notifications', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def list_notifications():
    """Get user's notifications."""
    user_id = int(get_jwt_identity())
    
    # Get pagination params
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    
    query = Notification.query.filter_by(user_id=user_id)
    
    if unread_only:
        query = query.filter_by(read=False)
    
    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    # Count unread
    unread_count = Notification.query.filter_by(user_id=user_id, read=False).count()
    
    return jsonify({
        'notifications': [n.to_dict() for n in notifications],
        'total': total,
        'unread_count': unread_count
    }), 200


@bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    """Get count of unread notifications."""
    user_id = int(get_jwt_identity())
    count = Notification.query.filter_by(user_id=user_id, read=False).count()
    return jsonify({'unread_count': count}), 200


@bp.route('/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a notification as read."""
    user_id = int(get_jwt_identity())
    
    notification = Notification.query.get(notification_id)
    
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    if notification.user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    notification.read = True
    notification.read_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Marked as read', 'notification': notification.to_dict()}), 200


@bp.route('/read-all', methods=['PUT'])
@jwt_required()
def mark_all_as_read():
    """Mark all notifications as read."""
    user_id = int(get_jwt_identity())
    
    Notification.query.filter_by(user_id=user_id, read=False).update({
        'read': True,
        'read_at': datetime.utcnow()
    })
    db.session.commit()
    
    return jsonify({'message': 'All notifications marked as read'}), 200


@bp.route('/<int:notification_id>', methods=['DELETE'])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification."""
    user_id = int(get_jwt_identity())
    
    notification = Notification.query.get(notification_id)
    
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    if notification.user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(notification)
    db.session.commit()
    
    return jsonify({'message': 'Notification deleted'}), 200


def create_mention_notification(mentioned_user_id: int, actor_id: int, entity_type: str, entity_id: int, project_id: int = None):
    """Helper function to create a mention notification."""
    # Don't notify yourself
    if mentioned_user_id == actor_id:
        return None
    
    link = None
    if project_id and entity_type == 'section':
        link = f'/projects/{project_id}/builder?section={entity_id}'
    elif project_id and entity_type == 'question':
        link = f'/projects/{project_id}?question={entity_id}'
    
    notification = Notification.create_mention_notification(
        user_id=mentioned_user_id,
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        link=link
    )
    
    db.session.add(notification)
    db.session.commit()
    
    return notification


def parse_mentions(text: str) -> list:
    """Parse @mentions from text and return list of usernames."""
    import re
    # Match @username patterns (alphanumeric + underscore)
    pattern = r'@(\w+)'
    return re.findall(pattern, text)


def process_mentions_in_comment(text: str, actor_id: int, entity_type: str, entity_id: int, org_id: int, project_id: int = None):
    """Process @mentions in a comment text and create notifications."""
    mentions = parse_mentions(text)
    
    if not mentions:
        return []
    
    notifications = []
    
    for username in mentions:
        # Find user by name (case-insensitive match on first part of name or full name)
        users = User.query.filter(
            User.organization_id == org_id,
            db.or_(
                User.name.ilike(f'{username}%'),
                User.name.ilike(f'%{username}%')
            )
        ).all()
        
        for user in users:
            if user.id != actor_id:
                notification = create_mention_notification(
                    mentioned_user_id=user.id,
                    actor_id=actor_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    project_id=project_id
                )
                if notification:
                    notifications.append(notification)
    
    return notifications
