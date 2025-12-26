"""Go/No-Go Analysis API routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import Project, User
from ..services.go_no_go_service import run_go_no_go_analysis, DIMENSION_WEIGHTS
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('go_no_go', __name__)


@bp.route('/projects/<int:project_id>/go-no-go/analyze', methods=['POST'])
@jwt_required()
def analyze_project(project_id):
    """
    Run Go/No-Go analysis for a project.
    
    Request body:
    {
        "criteria": {
            "team_available": 3,
            "required_team_size": 4,
            "key_skills_available": 80,
            "typical_response_days": 14,
            "incumbent_advantage": false,
            "relationship_score": 60,
            "pricing_competitiveness": 70,
            "unique_capabilities": 75
        }
    }
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    criteria = data.get('criteria', {})
    
    # Set default values for missing criteria
    default_criteria = {
        'team_available': 3,
        'required_team_size': 4,
        'key_skills_available': 70,
        'typical_response_days': 14,
        'incumbent_advantage': False,
        'relationship_score': 50,
        'pricing_competitiveness': 50,
        'unique_capabilities': 50
    }
    
    # Merge defaults with provided criteria
    for key, default_value in default_criteria.items():
        if key not in criteria:
            criteria[key] = default_value
    
    try:
        result = run_go_no_go_analysis(project_id, criteria, user_id)
        return jsonify({
            'message': 'Go/No-Go analysis completed',
            'analysis': result,
            'project': project.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Go/No-Go analysis failed: {e}")
        return jsonify({'error': 'Analysis failed', 'details': str(e)}), 500


@bp.route('/projects/<int:project_id>/go-no-go', methods=['GET'])
@jwt_required()
def get_analysis(project_id):
    """Get the current Go/No-Go analysis status for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    analysis = project.go_no_go_analysis or {}
    
    return jsonify({
        'status': project.go_no_go_status,
        'win_probability': project.go_no_go_score,
        'analysis': analysis,
        'completed_at': project.go_no_go_completed_at.isoformat() if project.go_no_go_completed_at else None,
        'weights': DIMENSION_WEIGHTS
    }), 200


@bp.route('/projects/<int:project_id>/go-no-go/criteria', methods=['GET'])
@jwt_required()
def get_criteria(project_id):
    """Get the current evaluation criteria and default values."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get saved criteria if exists
    analysis = project.go_no_go_analysis or {}
    saved_criteria = analysis.get('criteria_used', {})
    
    # Build response with project context
    criteria_context = {
        'project_name': project.name,
        'due_date': project.due_date.isoformat() if project.due_date else None,
        'industry': project.industry,
        'client_name': project.client_name,
        'client_type': project.client_type,
        'geography': project.geography,
        'project_value': project.project_value
    }
    
    # Default criteria values
    default_criteria = {
        'team_available': 3,
        'required_team_size': 4,
        'key_skills_available': 70,
        'typical_response_days': 14,
        'incumbent_advantage': False,
        'relationship_score': 50,
        'pricing_competitiveness': 50,
        'unique_capabilities': 50
    }
    
    return jsonify({
        'saved_criteria': saved_criteria,
        'default_criteria': default_criteria,
        'project_context': criteria_context,
        'weights': DIMENSION_WEIGHTS
    }), 200


@bp.route('/projects/<int:project_id>/go-no-go/decision', methods=['PUT'])
@jwt_required()
def update_decision(project_id):
    """
    Manually update the Go/No-Go decision.
    
    Request body:
    {
        "decision": "go" | "no_go" | "pending",
        "notes": "Optional decision notes"
    }
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    decision = data.get('decision')
    notes = data.get('notes', '')
    
    if decision not in ['go', 'no_go', 'pending']:
        return jsonify({'error': 'Invalid decision. Must be go, no_go, or pending'}), 400
    
    # Update project
    project.go_no_go_status = decision
    
    # Add notes to analysis
    analysis = project.go_no_go_analysis or {}
    analysis['manual_decision'] = {
        'decision': decision,
        'notes': notes,
        'decided_by': user_id,
        'decided_at': datetime.utcnow().isoformat()
    }
    project.go_no_go_analysis = analysis
    
    db.session.commit()
    
    return jsonify({
        'message': f'Decision updated to {decision}',
        'project': project.to_dict()
    }), 200


@bp.route('/projects/<int:project_id>/go-no-go/reset', methods=['POST'])
@jwt_required()
def reset_analysis(project_id):
    """Reset the Go/No-Go analysis for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Reset all Go/No-Go fields
    project.go_no_go_status = 'pending'
    project.go_no_go_score = None
    project.go_no_go_analysis = {}
    project.go_no_go_completed_at = None
    
    db.session.commit()
    
    return jsonify({
        'message': 'Go/No-Go analysis reset',
        'project': project.to_dict()
    }), 200
