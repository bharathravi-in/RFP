"""
Marketplace Routes
Phase 4: Market Leader
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.marketplace_service import get_marketplace_service
from ..models import User

bp = Blueprint('marketplace', __name__, url_prefix='/api/marketplace')


@bp.route('/templates', methods=['GET'])
@jwt_required()
def list_templates():
    """List available templates."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
        
    category = request.args.get('category')
    
    service = get_marketplace_service(user_id, user.organization_id)
    templates = service.get_templates(category)
    
    return jsonify({'templates': templates}), 200


@bp.route('/templates/<int:template_id>/install', methods=['POST'])
@jwt_required()
def install_template(template_id):
    """Install a template (create a new project)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
        
    data = request.get_json() or {}
    project_name = data.get('project_name')
    
    if not project_name:
        return jsonify({'error': 'Project name is required'}), 400
        
    service = get_marketplace_service(user_id, user.organization_id)
    try:
        project = service.install_template(template_id, project_name)
        return jsonify({
            'success': True,
            'message': 'Template installed successfully',
            'project': project.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/knowledge-packs/<pack_id>/install', methods=['POST'])
@jwt_required()
def install_knowledge_pack(pack_id):
    """Install an industry knowledge pack."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
        
    service = get_marketplace_service(user_id, user.organization_id)
    try:
        result = service.install_knowledge_pack(pack_id)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/knowledge-packs', methods=['GET'])
@jwt_required()
def list_knowledge_packs():
    """List available knowledge packs (hardcoded for now)."""
    # In a real app, this would query a database or external service
    packs = [
        {
            'id': 'saas-security',
            'name': 'SaaS Security Essentials',
            'description': 'Standard security Q&A for SaaS providers (SOC2, Encryption, etc.)',
            'category': 'Security',
            'item_count': 15,
            'is_premium': False
        },
        {
            'id': 'gdpr-compliance',
            'name': 'GDPR Compliance Pack',
            'description': 'Essential GDPR answers for data processors.',
            'category': 'Legal',
            'item_count': 10,
            'is_premium': False
        },
        {
            'id': 'healthcare-hipaa',
            'name': 'Healthcare / HIPAA',
            'description': 'HIPAA compliance answers for healthcare vendors.',
            'category': 'Healthcare',
            'item_count': 25,
            'is_premium': True
        }
    ]
    return jsonify({'knowledge_packs': packs}), 200
