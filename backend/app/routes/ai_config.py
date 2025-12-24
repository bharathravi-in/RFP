"""
AI Configuration Routes

API endpoints for managing organization AI provider configurations.
Now with support for LiteLLM and per-agent configuration.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Organization, OrganizationAIConfig, AgentAIConfig
from app.services.ai_config_service import AIConfigService
from app.extensions import db
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('ai_config', __name__, url_prefix='/api/organizations')


# ============================================================================
# Organization AI Configuration
# ============================================================================

@bp.route('/<int:org_id>/ai-config', methods=['GET'])
@jwt_required()
def get_ai_config(org_id):
    """Get organization AI configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check permissions
    if user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    config = OrganizationAIConfig.query.filter_by(
        organization_id=org_id,
        is_active=True
    ).first()
    
    return jsonify({
        'config': config.to_dict() if config else None
    })


@bp.route('/<int:org_id>/ai-config', methods=['POST'])
@jwt_required()
def update_ai_config(org_id):
    """Create or update AI configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('embedding_provider'):
        return jsonify({'error': 'embedding_provider is required'}), 400
    
    # Get or create config
    config = OrganizationAIConfig.query.filter_by(
        organization_id=org_id,
        is_active=True
    ).first()
    
    if not config:
        config = OrganizationAIConfig(organization_id=org_id)
    
    # Update embedding config
    config.embedding_provider = data.get('embedding_provider')
    config.embedding_model = data.get('embedding_model')
    config.embedding_api_endpoint = data.get('embedding_api_endpoint')
    config.embedding_dimension = data.get('embedding_dimension', 768)
    
    if 'embedding_api_key' in data and data['embedding_api_key']:
        config.set_embedding_key(data['embedding_api_key'])
    
    # Update LLM config
    config.llm_provider = data.get('llm_provider', 'google')
    config.llm_model = data.get('llm_model')
    
    if 'llm_api_key' in data and data['llm_api_key']:
        config.set_llm_key(data['llm_api_key'])
    
    # Update LiteLLM proxy config
    if 'litellm_base_url' in data:
        config.litellm_base_url = data['litellm_base_url']
    
    if 'litellm_api_key' in data and data['litellm_api_key']:
        config.set_litellm_key(data['litellm_api_key'])
    
    # Update metadata
    if 'config_metadata' in data:
        config.config_metadata = data['config_metadata']
    
    db.session.add(config)
    db.session.commit()
    
    logger.info(f"Updated AI config for org {org_id}: {config.embedding_provider}")
    
    return jsonify({
        'message': 'Configuration saved successfully',
        'config': config.to_dict()
    }), 200


# ============================================================================
# Agent-Specific Configuration
# ============================================================================

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
        'configs': [c.to_dict() for c in configs],
        'available_agents': get_available_agents()
    })


@bp.route('/<int:org_id>/agent-configs/<agent_type>', methods=['GET'])
@jwt_required()
def get_agent_config(org_id, agent_type):
    """Get configuration for specific agent."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    config = AIConfigService.get_agent_config(org_id, agent_type)
    
    if not config:
        return jsonify({'config': None, 'using_default': True})
    
    return jsonify({
        'config': config.to_dict(),
        'using_default': config.agent_type == 'default' and agent_type != 'default'
    })


@bp.route('/<int:org_id>/agent-configs/<agent_type>', methods=['POST'])
@jwt_required()
def update_agent_config(org_id, agent_type):
    """Create or update agent-specific configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('provider'):
        return jsonify({'error': 'provider is required'}), 400
    if not data.get('model'):
        return jsonify({'error': 'model is required'}), 400
    
    try:
        config = AIConfigService.create_or_update_agent_config(
            org_id=org_id,
            agent_type=agent_type,
            data=data
        )
        
        logger.info(f"Updated agent config: org={org_id}, agent={agent_type}")
        
        return jsonify({
            'message': f'Configuration for {agent_type} saved successfully',
            'config': config.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to update agent config: {e}")
        return jsonify({'error': str(e)}), 400


@bp.route('/<int:org_id>/agent-configs/<agent_type>', methods=['DELETE'])
@jwt_required()
def delete_agent_config(org_id, agent_type):
    """Delete agent-specific configuration (falls back to default)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if agent_type == 'default':
        return jsonify({'error': 'Cannot delete default configuration'}), 400
    
    success = AIConfigService.delete_agent_config(org_id, agent_type)
    
    if success:
        return jsonify({
            'message': f'Configuration for {agent_type} deleted, now using default'
        })
    else:
        return jsonify({'error': 'Configuration not found'}), 404


# ============================================================================
# Connection Testing
# ============================================================================

@bp.route('/<int:org_id>/ai-config/test', methods=['POST'])
@jwt_required()
def test_provider(org_id):
    """Test embedding provider connection without saving."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('provider') or not data.get('api_key'):
        return jsonify({'error': 'provider and api_key are required'}), 400
    
    try:
        from app.services.embedding_providers import EmbeddingProviderFactory
        
        # Create provider instance
        provider = EmbeddingProviderFactory.create(
            provider=data['provider'],
            api_key=data['api_key'],
            model=data.get('model'),
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
            'model': data.get('model')
        })
    except Exception as e:
        logger.error(f"Provider test failed: {e}")
        return jsonify({
            'success': False,
            'message': f'Connection failed: {str(e)}'
        }), 400


@bp.route('/<int:org_id>/agent-configs/test', methods=['POST'])
@jwt_required()
def test_llm_provider(org_id):
    """Test LLM provider connection."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    provider = data.get('provider', 'google')
    api_key = data.get('api_key')
    model = data.get('model', 'gemini-1.5-flash')
    
    # Only use base_url for providers that need it (LiteLLM and Azure)
    base_url = None
    if provider in ('litellm', 'azure'):
        base_url = data.get('base_url') or data.get('api_endpoint')
        if provider == 'litellm' and not base_url:
            base_url = 'https://litellm.tarento.dev'  # Default for LiteLLM only
    
    if not api_key:
        return jsonify({'error': 'api_key is required'}), 400
    
    try:
        from app.services.llm_providers import LLMProviderFactory
        
        # Create provider instance
        llm_provider = LLMProviderFactory.create(
            provider=provider,
            api_key=api_key,
            model=model,
            base_url=base_url
        )
        
        # Test connection
        result = llm_provider.test_connection()
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except ImportError as e:
        return jsonify({
            'success': False,
            'message': f'Provider package not installed: {str(e)}'
        }), 400
    except Exception as e:
        logger.error(f"LLM provider test failed: {e}")
        return jsonify({
            'success': False,
            'message': f'Connection failed: {str(e)}'
        }), 400


# ============================================================================
# Provider Information
# ============================================================================

@bp.route('/<int:org_id>/ai-config/providers', methods=['GET'])
@jwt_required()
def get_supported_providers(org_id):
    """Get list of supported providers and their models."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    providers = {
        'litellm': {
            'name': 'LiteLLM Proxy',
            'description': 'Multi-model access via LiteLLM proxy server',
            'llm_models': [
                {'value': 'gemini-flash', 'label': 'Gemini Flash', 'description': 'Fast, efficient'},
                {'value': 'gemini-pro', 'label': 'Gemini Pro', 'description': 'Most capable'},
                {'value': 'gemini-flash-lite', 'label': 'Gemini Flash Lite', 'description': 'Lightweight'}
            ],
            'requires_endpoint': True,
            'default_endpoint': 'https://litellm.tarento.dev',
            'supports_agent_config': True
        },
        'google': {
            'name': 'Google AI',
            'description': 'Direct access to Google Generative AI',
            'embedding_models': [
                {'value': 'models/text-embedding-004', 'label': 'text-embedding-004 (768d)', 'dimension': 768}
            ],
            'llm_models': [
                {'value': 'gemini-1.5-pro', 'label': 'Gemini 1.5 Pro'},
                {'value': 'gemini-1.5-flash', 'label': 'Gemini 1.5 Flash'}
            ],
            'requires_endpoint': False,
            'api_key_link': 'https://makersuite.google.com/app/apikey',
            'supports_agent_config': True
        },
        'openai': {
            'name': 'OpenAI',
            'description': 'Access to GPT models',
            'embedding_models': [
                {'value': 'text-embedding-3-small', 'label': 'text-embedding-3-small (1536d)', 'dimension': 1536},
                {'value': 'text-embedding-3-large', 'label': 'text-embedding-3-large (3072d)', 'dimension': 3072}
            ],
            'llm_models': [
                {'value': 'gpt-4-turbo', 'label': 'GPT-4 Turbo'},
                {'value': 'gpt-4', 'label': 'GPT-4'},
                {'value': 'gpt-3.5-turbo', 'label': 'GPT-3.5 Turbo'}
            ],
            'requires_endpoint': False,
            'api_key_link': 'https://platform.openai.com/api-keys',
            'supports_agent_config': True
        },
        'azure': {
            'name': 'Azure OpenAI',
            'description': 'Azure-hosted OpenAI models',
            'embedding_models': [
                {'value': 'text-embedding-ada-002', 'label': 'text-embedding-ada-002 (1536d)', 'dimension': 1536}
            ],
            'llm_models': [
                {'value': 'gpt-4', 'label': 'GPT-4'},
                {'value': 'gpt-35-turbo', 'label': 'GPT-3.5 Turbo'}
            ],
            'requires_endpoint': True,
            'api_key_link': 'https://portal.azure.com',
            'supports_agent_config': True
        }
    }
    
    return jsonify({
        'providers': providers,
        'available_agents': get_available_agents()
    })


def get_available_agents():
    """Get list of available agent types for configuration."""
    return [
        {
            'type': 'default',
            'name': 'Default',
            'description': 'Default configuration for all agents'
        },
        {
            'type': 'document_analysis',
            'name': 'Document Analyzer',
            'description': 'Analyzes RFP document structure'
        },
        {
            'type': 'question_extraction',
            'name': 'Question Extractor',
            'description': 'Extracts questions from RFP documents'
        },
        {
            'type': 'knowledge_base',
            'name': 'Knowledge Base',
            'description': 'Retrieves relevant knowledge context'
        },
        {
            'type': 'answer_generation',
            'name': 'Answer Generator',
            'description': 'Generates answers for questions'
        },
        {
            'type': 'answer_validation',
            'name': 'Answer Validator',
            'description': 'Validates generated answers'
        },
        {
            'type': 'compliance_checking',
            'name': 'Compliance Checker',
            'description': 'Checks compliance claims'
        },
        {
            'type': 'quality_review',
            'name': 'Quality Reviewer',
            'description': 'Reviews response quality'
        },
        {
            'type': 'clarification',
            'name': 'Clarification Agent',
            'description': 'Identifies clarification needs'
        },
        {
            'type': 'diagram_generation',
            'name': 'Diagram Generator',
            'description': 'Generates diagrams and visuals'
        },
        {
            'type': 'ppt_generation',
            'name': 'PPT Generator',
            'description': 'Generates PowerPoint presentations'
        },
        {
            'type': 'section_mapping',
            'name': 'Section Mapper',
            'description': 'Maps questions to sections'
        },
        {
            'type': 'feedback_learning',
            'name': 'Feedback Learning',
            'description': 'Learns from user feedback'
        }
    ]
