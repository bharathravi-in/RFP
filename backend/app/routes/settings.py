"""
Settings API Routes

Provides endpoints for configuring application-wide and per-agent settings.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, OrganizationAIConfig, AgentAIConfig
from ..services.rbac import require_permission
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('settings', __name__, url_prefix='/api/settings')


@bp.route('/agent-configs', methods=['GET'])
@jwt_required()
def get_agent_configs():
    """
    Get agent configurations for the current organization.
    """
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    # Get all agent configs for this org
    configs = AgentAIConfig.query.filter_by(
        organization_id=user.organization_id
    ).all()
    
    return jsonify({
        'agents': [config.to_dict() for config in configs]
    })


@bp.route('/agent-configs', methods=['PUT'])
@jwt_required()
@require_permission('manage_ai_config')
def save_agent_configs():
    """
    Save agent configurations for the organization.
    
    Request body:
    {
        "agents": [
            {
                "agent_type": "answer_generator",
                "selected_model": "gpt-4o",
                "timeout_seconds": 90,
                "max_retries": 3
            }
        ]
    }
    """
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    data = request.get_json() or {}
    agents = data.get('agents', [])
    
    for agent_data in agents:
        agent_type = agent_data.get('agent_type')
        if not agent_type:
            continue
        
        # Get or create config
        config = AgentAIConfig.query.filter_by(
            organization_id=user.organization_id,
            agent_type=agent_type
        ).first()
        
        if not config:
            config = AgentAIConfig(
                organization_id=user.organization_id,
                agent_type=agent_type
            )
            db.session.add(config)
        
        # Update fields
        if 'selected_model' in agent_data:
            config.model = agent_data['selected_model']
        if 'timeout_seconds' in agent_data:
            config.timeout_seconds = agent_data['timeout_seconds']
        if 'max_retries' in agent_data:
            config.max_retries = agent_data['max_retries']
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Agent configurations saved'
    })


@bp.route('/agent-configs/<agent_type>', methods=['GET'])
@jwt_required()
def get_agent_config(agent_type: str):
    """Get configuration for a specific agent."""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    config = AgentAIConfig.query.filter_by(
        organization_id=user.organization_id,
        agent_type=agent_type
    ).first()
    
    if not config:
        # Return defaults
        return jsonify({
            'agent_type': agent_type,
            'model': 'gpt-4o-mini',
            'timeout_seconds': 60,
            'max_retries': 3
        })
    
    return jsonify(config.to_dict())


@bp.route('/resilience/config', methods=['GET'])
@jwt_required()
def get_resilience_config():
    """Get resilience configuration (circuit breaker, retries, timeouts)."""
    from ..services.agent_resilience import get_resilience_service
    
    service = get_resilience_service()
    
    return jsonify({
        'circuit_breaker': {
            'failure_threshold': service._circuit_config.failure_threshold,
            'success_threshold': service._circuit_config.success_threshold,
            'timeout_seconds': service._circuit_config.timeout_seconds
        },
        'retry': {
            'max_retries': service._retry_config.max_retries,
            'base_delay': service._retry_config.base_delay,
            'max_delay': service._retry_config.max_delay,
            'exponential_base': service._retry_config.exponential_base
        },
        'timeouts': {
            'default': service._timeout_config.default_timeout,
            'document_analysis': service._timeout_config.document_analysis,
            'answer_generation': service._timeout_config.answer_generation,
            'export_generation': service._timeout_config.export_generation,
            'simple_validation': service._timeout_config.simple_validation
        }
    })
