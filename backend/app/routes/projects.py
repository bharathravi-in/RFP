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
    from ..models import Organization, KnowledgeProfile
    
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
        # Multi-dimensional fields
        client_type=data.get('client_type'),
        geography=data.get('geography'),
        currency=data.get('currency'),
        industry=data.get('industry'),
        compliance_requirements=data.get('compliance_requirements', []),
        language=data.get('language', 'en'),
        client_name=data.get('client_name'),
        project_value=data.get('project_value'),
        organization_id=user.organization_id,
        created_by=user.id
    )
    
    db.session.add(project)
    db.session.flush()  # Get project ID
    
    # Assign knowledge profiles if provided
    profile_ids = data.get('knowledge_profile_ids', [])
    if profile_ids:
        profiles = KnowledgeProfile.query.filter(
            KnowledgeProfile.id.in_(profile_ids),
            KnowledgeProfile.organization_id == user.organization_id,
            KnowledgeProfile.is_active == True
        ).all()
        project.knowledge_profiles = profiles
    
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
    from ..models import KnowledgeProfile
    
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
    
    # Basic fields
    if 'name' in data:
        project.name = data['name']
    if 'description' in data:
        project.description = data['description']
    if 'status' in data:
        project.status = data['status']
    if 'due_date' in data:
        project.due_date = data['due_date']
    
    # Multi-dimensional fields
    if 'client_type' in data:
        project.client_type = data['client_type']
    if 'geography' in data:
        project.geography = data['geography']
    if 'currency' in data:
        project.currency = data['currency']
    if 'industry' in data:
        project.industry = data['industry']
    if 'compliance_requirements' in data:
        project.compliance_requirements = data['compliance_requirements']
    if 'language' in data:
        project.language = data['language']
    if 'client_name' in data:
        project.client_name = data['client_name']
    if 'project_value' in data:
        project.project_value = data['project_value']
    
    # Outcome fields
    if 'outcome' in data:
        project.outcome = data['outcome']
    if 'outcome_date' in data:
        project.outcome_date = data['outcome_date']
    if 'outcome_notes' in data:
        project.outcome_notes = data['outcome_notes']
    if 'contract_value' in data:
        project.contract_value = data['contract_value']
    if 'loss_reason' in data:
        project.loss_reason = data['loss_reason']
    
    # Update knowledge profiles if provided
    if 'knowledge_profile_ids' in data:
        profile_ids = data['knowledge_profile_ids']
        profiles = KnowledgeProfile.query.filter(
            KnowledgeProfile.id.in_(profile_ids),
            KnowledgeProfile.organization_id == user.organization_id,
            KnowledgeProfile.is_active == True
        ).all()
        project.knowledge_profiles = profiles
    
    db.session.commit()
    
    return jsonify({
        'message': 'Project updated',
        'project': project.to_dict(include_stats=True)
    }), 200


@bp.route('/<int:project_id>/outcome', methods=['PUT'])
@jwt_required()
def update_project_outcome(project_id):
    """Update project outcome (won/lost/abandoned) - dedicated endpoint for analytics."""
    from datetime import datetime
    
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
    
    outcome = data.get('outcome')
    if outcome not in ['pending', 'won', 'lost', 'abandoned']:
        return jsonify({'error': 'Invalid outcome. Must be: pending, won, lost, or abandoned'}), 400
    
    project.outcome = outcome
    project.outcome_date = datetime.utcnow()
    project.outcome_notes = data.get('outcome_notes')
    
    # Outcome-specific fields
    if outcome == 'won':
        project.contract_value = data.get('contract_value')
        project.loss_reason = None
    elif outcome == 'lost':
        project.loss_reason = data.get('loss_reason')
        project.contract_value = None
    else:
        project.contract_value = None
        project.loss_reason = None
    
    db.session.commit()
    
    return jsonify({
        'message': f'Project marked as {outcome}',
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

