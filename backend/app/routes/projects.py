from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Project, User

bp = Blueprint('projects', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def list_projects():
    """List all projects for user's organization."""
    user_id = int(get_jwt_identity())  # JWT stores as string
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Users without organization get empty list
    if not user.organization_id:
        return jsonify({'projects': []}), 200
    
    projects = Project.query.filter_by(
        organization_id=user.organization_id
    ).order_by(Project.updated_at.desc()).all()
    
    return jsonify({
        'projects': [p.to_dict(include_stats=True) for p in projects]
    }), 200


@bp.route('', methods=['POST'])
@jwt_required()
def create_project():
    """Create a new project."""
    from ..models import Organization
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Auto-create organization for users without one
    if not user.organization_id:
        org = Organization(
            name=f"{user.name}'s Organization",
            slug=f"org-{user.id}",
            settings={}
        )
        db.session.add(org)
        db.session.flush()
        user.organization_id = org.id
        user.role = 'admin'  # Make them admin of their org
        db.session.commit()
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Project name required'}), 400
    
    project = Project(
        name=data['name'],
        description=data.get('description', ''),
        due_date=data.get('due_date'),
        organization_id=user.organization_id,
        created_by=user.id
    )
    
    db.session.add(project)
    db.session.commit()
    
    return jsonify({
        'message': 'Project created',
        'project': project.to_dict(include_stats=True)
    }), 201


@bp.route('/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    """Get project details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'project': project.to_dict(include_stats=True)
    }), 200


@bp.route('/<int:project_id>', methods=['PUT'])
@jwt_required()
def update_project(project_id):
    """Update project details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        project.name = data['name']
    if 'description' in data:
        project.description = data['description']
    if 'status' in data:
        project.status = data['status']
    if 'due_date' in data:
        project.due_date = data['due_date']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Project updated',
        'project': project.to_dict(include_stats=True)
    }), 200


@bp.route('/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    """Delete a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(project)
    db.session.commit()
    
    return jsonify({'message': 'Project deleted'}), 200


@bp.route('/<int:project_id>/reviewers', methods=['POST'])
@jwt_required()
def assign_reviewers(project_id):
    """Assign reviewers to a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    reviewer_ids = data.get('reviewer_ids', [])
    
    # Get valid users from same organization
    reviewers = User.query.filter(
        User.id.in_(reviewer_ids),
        User.organization_id == user.organization_id
    ).all()
    
    project.reviewers = reviewers
    db.session.commit()
    
    return jsonify({
        'message': 'Reviewers assigned',
        'reviewers': [r.to_dict() for r in reviewers]
    }), 200
