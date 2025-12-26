"""Activity Log API routes for project activity timeline."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import ActivityLog, User, Project

bp = Blueprint('activity', __name__)


@bp.route('/project/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project_activity(project_id):
    """Get activity timeline for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Verify project access
    project = Project.query.filter_by(
        id=project_id,
        organization_id=user.organization_id
    ).first()
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Get pagination params
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    # Query activities
    activities = ActivityLog.query.filter_by(
        project_id=project_id
    ).order_by(
        ActivityLog.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    total = ActivityLog.query.filter_by(project_id=project_id).count()
    
    return jsonify({
        'activities': [a.to_dict() for a in activities],
        'total': total,
        'limit': limit,
        'offset': offset
    }), 200


@bp.route('/recent', methods=['GET'])
@jwt_required()
def get_recent_activity():
    """Get recent activity across all projects for dashboard."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.organization_id:
        return jsonify({'activities': [], 'total': 0}), 200
    
    limit = request.args.get('limit', 10, type=int)
    
    activities = ActivityLog.query.filter_by(
        organization_id=user.organization_id
    ).order_by(
        ActivityLog.created_at.desc()
    ).limit(limit).all()
    
    return jsonify({
        'activities': [a.to_dict() for a in activities],
        'total': len(activities)
    }), 200


@bp.route('', methods=['POST'])
@jwt_required()
def log_activity():
    """Manually log an activity (for frontend actions)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.json or {}
    
    required = ['action', 'entity_type']
    if not all(k in data for k in required):
        return jsonify({'error': 'Missing required fields'}), 400
    
    activity = ActivityLog.log(
        organization_id=user.organization_id,
        user_id=user_id,
        action=data['action'],
        entity_type=data['entity_type'],
        entity_id=data.get('entity_id'),
        entity_name=data.get('entity_name'),
        project_id=data.get('project_id'),
        description=data.get('description'),
        extra_data=data.get('extra_data')
    )
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'activity': activity.to_dict()
    }), 201
