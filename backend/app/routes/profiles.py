"""
Knowledge Profile API Routes.

Provides endpoints for managing knowledge profiles with multi-dimensional filtering.
"""
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import KnowledgeProfile, DimensionValues, User
from ..extensions import db

profiles_bp = Blueprint('profiles', __name__)


def get_current_user():
    """Get the current authenticated user."""
    user_id = get_jwt_identity()
    return User.query.get(user_id)


@profiles_bp.route('/profiles', methods=['GET'])
@jwt_required()
def list_profiles():
    """List all knowledge profiles for the organization."""
    user = get_current_user()
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization required'}), 400
    
    profiles = KnowledgeProfile.query.filter_by(
        organization_id=user.organization_id,
        is_active=True
    ).order_by(KnowledgeProfile.priority.desc(), KnowledgeProfile.name).all()
    
    return jsonify({
        'profiles': [p.to_dict(include_items_count=True) for p in profiles]
    })


@profiles_bp.route('/profiles', methods=['POST'])
@jwt_required()
def create_profile():
    """Create a new knowledge profile."""
    user = get_current_user()
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization required'}), 400
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Profile name is required'}), 400
    
    profile = KnowledgeProfile(
        name=data['name'],
        description=data.get('description'),
        geographies=data.get('geographies', []),
        client_types=data.get('client_types', []),
        currencies=data.get('currencies', []),
        industries=data.get('industries', []),
        compliance_frameworks=data.get('compliance_frameworks', []),
        languages=data.get('languages', []),
        custom_tags=data.get('custom_tags', {}),
        is_default=data.get('is_default', False),
        priority=data.get('priority', 0),
        organization_id=user.organization_id,
        created_by=user.id
    )
    
    # If setting as default, unset other defaults
    if profile.is_default:
        KnowledgeProfile.query.filter_by(
            organization_id=user.organization_id,
            is_default=True
        ).update({'is_default': False})
    
    db.session.add(profile)
    db.session.commit()
    
    return jsonify({
        'message': 'Profile created successfully',
        'profile': profile.to_dict()
    }), 201


@profiles_bp.route('/profiles/<int:profile_id>', methods=['GET'])
@jwt_required()
def get_profile(profile_id):
    """Get a specific knowledge profile."""
    user = get_current_user()
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization required'}), 400
    
    profile = KnowledgeProfile.query.filter_by(
        id=profile_id,
        organization_id=user.organization_id
    ).first()
    
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    return jsonify({
        'profile': profile.to_dict(include_items_count=True)
    })


@profiles_bp.route('/profiles/<int:profile_id>', methods=['PUT'])
@jwt_required()
def update_profile(profile_id):
    """Update a knowledge profile."""
    user = get_current_user()
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization required'}), 400
    
    profile = KnowledgeProfile.query.filter_by(
        id=profile_id,
        organization_id=user.organization_id
    ).first()
    
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    data = request.get_json()
    
    # Update fields if provided
    if 'name' in data:
        profile.name = data['name']
    if 'description' in data:
        profile.description = data['description']
    if 'geographies' in data:
        profile.geographies = data['geographies']
    if 'client_types' in data:
        profile.client_types = data['client_types']
    if 'currencies' in data:
        profile.currencies = data['currencies']
    if 'industries' in data:
        profile.industries = data['industries']
    if 'compliance_frameworks' in data:
        profile.compliance_frameworks = data['compliance_frameworks']
    if 'languages' in data:
        profile.languages = data['languages']
    if 'custom_tags' in data:
        profile.custom_tags = data['custom_tags']
    if 'priority' in data:
        profile.priority = data['priority']
    if 'is_default' in data:
        if data['is_default']:
            KnowledgeProfile.query.filter_by(
                organization_id=user.organization_id,
                is_default=True
            ).update({'is_default': False})
        profile.is_default = data['is_default']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated successfully',
        'profile': profile.to_dict()
    })


@profiles_bp.route('/profiles/<int:profile_id>', methods=['DELETE'])
@jwt_required()
def delete_profile(profile_id):
    """Delete (deactivate) a knowledge profile."""
    user = get_current_user()
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization required'}), 400
    
    profile = KnowledgeProfile.query.filter_by(
        id=profile_id,
        organization_id=user.organization_id
    ).first()
    
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    profile.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'Profile deleted successfully'})


# Dimension lookup endpoints
@profiles_bp.route('/dimensions', methods=['GET'])
@jwt_required()
def get_all_dimensions():
    """Get all available dimension values."""
    return jsonify({
        'geographies': DimensionValues.GEOGRAPHIES,
        'client_types': DimensionValues.CLIENT_TYPES,
        'currencies': DimensionValues.CURRENCIES,
        'industries': DimensionValues.INDUSTRIES,
        'compliance_frameworks': DimensionValues.COMPLIANCE_FRAMEWORKS
    })


@profiles_bp.route('/dimensions/geographies', methods=['GET'])
@jwt_required()
def get_geographies():
    """Get available geography values."""
    return jsonify({'geographies': DimensionValues.GEOGRAPHIES})


@profiles_bp.route('/dimensions/client-types', methods=['GET'])
@jwt_required()
def get_client_types():
    """Get available client type values."""
    return jsonify({'client_types': DimensionValues.CLIENT_TYPES})


@profiles_bp.route('/dimensions/currencies', methods=['GET'])
@jwt_required()
def get_currencies():
    """Get available currency values."""
    return jsonify({'currencies': DimensionValues.CURRENCIES})


@profiles_bp.route('/dimensions/industries', methods=['GET'])
@jwt_required()
def get_industries():
    """Get available industry values."""
    return jsonify({'industries': DimensionValues.INDUSTRIES})


@profiles_bp.route('/dimensions/compliance', methods=['GET'])
@jwt_required()
def get_compliance_frameworks():
    """Get available compliance framework values."""
    return jsonify({'compliance_frameworks': DimensionValues.COMPLIANCE_FRAMEWORKS})
