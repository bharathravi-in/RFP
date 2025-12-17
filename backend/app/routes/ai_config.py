"""
AI Configuration Routes

API endpoints for managing organization AI provider configurations.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Organization, OrganizationAIConfig
from app.extensions import db
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('ai_config', __name__, url_prefix='/api/organizations')


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


@bp.route('/<int:org_id>/ai-config/test', methods=['POST'])
@jwt_required()
def test_provider(org_id):
    """Test provider connection without saving."""
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


@bp.route('/<int:org_id>/ai-config/providers', methods=['GET'])
@jwt_required()
def get_supported_providers(org_id):
    """Get list of supported providers and their models."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or user.organization_id != org_id:
        return jsonify({'error': 'Access denied'}), 403
    
    providers = {
        'google': {
            'name': 'Google AI',
            'embedding_models': [
                {'value': 'models/text-embedding-004', 'label': 'text-embedding-004 (768d)', 'dimension': 768}
            ],
            'llm_models': [
                {'value': 'gemini-1.5-pro', 'label': 'Gemini 1.5 Pro'},
                {'value': 'gemini-1.5-flash', 'label': 'Gemini 1.5 Flash'}
            ],
            'requires_endpoint': False,
            'api_key_link': 'https://makersuite.google.com/app/apikey'
        },
        'openai': {
            'name': 'OpenAI',
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
            'api_key_link': 'https://platform.openai.com/api-keys'
        },
        'azure': {
            'name': 'Azure OpenAI',
            'embedding_models': [
                {'value': 'text-embedding-ada-002', 'label': 'text-embedding-ada-002 (1536d)', 'dimension': 1536}
            ],
            'llm_models': [
                {'value': 'gpt-4', 'label': 'GPT-4'},
                {'value': 'gpt-35-turbo', 'label': 'GPT-3.5 Turbo'}
            ],
            'requires_endpoint': True,
            'api_key_link': 'https://portal.azure.com'
        }
    }
    
    return jsonify({'providers': providers})
