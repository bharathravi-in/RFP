"""
Agent AI Configuration Routes

API endpoints for managing agent-specific AI configurations.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, AgentAIConfig
from app.services.ai_config_service import AIConfigService
from app.extensions import db
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('agent_config', __name__, url_prefix='/api/organizations')


@bp.route('/<int:org_id>/agent-configs', methods=['GET'])
@jwt_required()
def list_agent_configs(org_id):
    """List all agent configurations for organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    configs = AIConfigService.list_agent_configs(org_id)
    
    return jsonify({
        'configs': [config.to_dict() for config in configs]
    })


@bp.route('/<int:org_id>/agent-configs/<string:agent_type>', methods=['GET'])
@jwt_required()
def get_agent_config(org_id, agent_type):
    """Get configuration for specific agent."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    config = AIConfigService.get_agent_config(org_id, agent_type)
    
    return jsonify({
        'config': config.to_dict() if config else None
    })


@bp.route('/<int:org_id>/agent-configs/<string:agent_type>', methods=['POST'])
@jwt_required()
def create_or_update_agent_config(org_id, agent_type):
    """Create or update agent configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('provider') or not data.get('model'):
        return jsonify({'error': 'provider and model are required'}), 400
    
    try:
        config = AIConfigService.create_or_update_agent_config(
            org_id=org_id,
            agent_type=agent_type,
            data=data
        )
        
        return jsonify({
            'message': 'Configuration saved successfully',
            'config': config.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Failed to save agent config: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:org_id>/agent-configs/<string:agent_type>', methods=['DELETE'])
@jwt_required()
def delete_agent_config(org_id, agent_type):
    """Delete agent-specific configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if agent_type == 'default':
        return jsonify({'error': 'Cannot delete default configuration'}), 400
    
    success = AIConfigService.delete_agent_config(org_id, agent_type)
    
    if success:
        return jsonify({'message': 'Configuration deleted successfully'}), 200
    else:
        return jsonify({'error': 'Configuration not found'}), 404


@bp.route('/<int:org_id>/agent-configs/<string:agent_type>/test', methods=['POST'])
@jwt_required()
def test_agent_provider(org_id, agent_type):
    """Test provider connection for agent."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('provider') or not data.get('api_key') or not data.get('model'):
        return jsonify({'error': 'provider, api_key, and model are required'}), 400
    
    try:
        from app.services.embedding_providers import EmbeddingProviderFactory
        
        # Create provider instance
        provider = EmbeddingProviderFactory.create(
            provider=data['provider'],
            api_key=data['api_key'],
            model=data['model'],  # Free text!
            endpoint=data.get('endpoint')
        )
        
        # Test with sample text
        test_text = "This is a test to verify the API connection."
        embedding = provider.get_embedding(test_text)
        
        return jsonify({
            'success': True,
            'message': f'Successfully connected to {provider.provider_name}!',
            'dimension': len(embedding),
            'provider': provider.provider_name,
            'model': data['model']
        })
    except Exception as e:
        logger.error(f"Provider test failed: {e}")
        return jsonify({
            'success': False,
            'message': f'Connection failed: {str(e)}'
        }), 400


@bp.route('/<int:org_id>/agent-types', methods=['GET'])
@jwt_required()
def get_agent_types(org_id):
    """Get list of predefined agent types."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    agent_types = {
        'default': {
            'name': 'Default Configuration',
            'description': 'Fallback configuration for all agents',
            'required': True
        },
        'embedding': {
            'name': 'Embedding Agent',
            'description': 'Semantic search and knowledge base embeddings',
            'required': False
        },
        'rfp_analysis': {
            'name': 'RFP Analysis Agent',
            'description': 'RFP document analysis and extraction',
            'required': False
        },
        'answer_generation': {
            'name': 'Answer Generation Agent',
            'description': 'Generate answers to RFP questions',
            'required': False
        },
        'ppt_generation': {
            'name': 'PPT Generation Agent',
            'description': 'PowerPoint and presentation creation',
            'required': False
        },
        'diagram_generation': {
            'name': 'Diagram Generation Agent',
            'description': 'Diagrams, charts, and visual content',
            'required': False
        },
        'summarization': {
            'name': 'Summarization Agent',
            'description': 'Document and content summarization',
            'required': False
        }
    }
    
    return jsonify({'agent_types': agent_types})
