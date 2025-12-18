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


# Dimension lookup endpoints - from database
@profiles_bp.route('/dimensions', methods=['GET'])
@jwt_required()
def get_all_dimensions():
    """Get all available dimension values from database."""
    from ..models import FilterDimension
    user = get_current_user()
    
    # Get system dimensions + org-specific dimensions
    query = FilterDimension.query.filter(
        FilterDimension.is_active == True
    ).filter(
        db.or_(
            FilterDimension.organization_id == None,  # System dimensions
            FilterDimension.organization_id == user.organization_id if user else False
        )
    ).order_by(FilterDimension.dimension_type, FilterDimension.sort_order)
    
    dimensions = query.all()
    
    # Group by dimension type
    result = {}
    for dim in dimensions:
        if dim.dimension_type not in result:
            result[dim.dimension_type] = []
        result[dim.dimension_type].append(dim.to_dict())
    
    return jsonify(result)


@profiles_bp.route('/dimensions/<dimension_type>', methods=['GET'])
@jwt_required()
def get_dimension_by_type(dimension_type):
    """Get dimension values for a specific type."""
    from ..models import FilterDimension
    user = get_current_user()
    
    valid_types = ['geography', 'client_type', 'currency', 'industry', 'compliance']
    if dimension_type not in valid_types:
        return jsonify({'error': f'Invalid dimension type. Valid types: {valid_types}'}), 400
    
    dimensions = FilterDimension.query.filter(
        FilterDimension.dimension_type == dimension_type,
        FilterDimension.is_active == True
    ).filter(
        db.or_(
            FilterDimension.organization_id == None,
            FilterDimension.organization_id == user.organization_id if user else False
        )
    ).order_by(FilterDimension.sort_order).all()
    
    return jsonify({
        dimension_type: [d.to_dict() for d in dimensions]
    })


@profiles_bp.route('/dimensions', methods=['POST'])
@jwt_required()
def create_dimension():
    """Create a custom dimension value for the organization."""
    from ..models import FilterDimension
    user = get_current_user()
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization required'}), 400
    
    data = request.get_json()
    
    required_fields = ['dimension_type', 'code', 'name']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    valid_types = ['geography', 'client_type', 'currency', 'industry', 'compliance']
    if data['dimension_type'] not in valid_types:
        return jsonify({'error': f'Invalid dimension type. Valid types: {valid_types}'}), 400
    
    # Check if already exists
    existing = FilterDimension.query.filter_by(
        dimension_type=data['dimension_type'],
        code=data['code'],
        organization_id=user.organization_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Dimension with this code already exists'}), 400
    
    dimension = FilterDimension(
        dimension_type=data['dimension_type'],
        code=data['code'],
        name=data['name'],
        description=data.get('description'),
        parent_code=data.get('parent_code'),
        icon=data.get('icon'),
        sort_order=data.get('sort_order', 100),
        is_system=False,
        organization_id=user.organization_id
    )
    
    db.session.add(dimension)
    db.session.commit()
    
    return jsonify({
        'message': 'Dimension created successfully',
        'dimension': dimension.to_dict()
    }), 201


@profiles_bp.route('/dimensions/<int:dimension_id>', methods=['DELETE'])
@jwt_required()
def delete_dimension(dimension_id):
    """Delete a custom dimension (only org-specific, not system)."""
    from ..models import FilterDimension
    user = get_current_user()
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization required'}), 400
    
    dimension = FilterDimension.query.get(dimension_id)
    
    if not dimension:
        return jsonify({'error': 'Dimension not found'}), 404
    
    if dimension.is_system:
        return jsonify({'error': 'Cannot delete system dimensions'}), 403
    
    if dimension.organization_id != user.organization_id:
        return jsonify({'error': 'Not authorized'}), 403
    
    db.session.delete(dimension)
    db.session.commit()
    
    return jsonify({'message': 'Dimension deleted successfully'})


# Legacy endpoints for backward compatibility (redirect to new DB-backed endpoints)
@profiles_bp.route('/dimensions/geographies', methods=['GET'])
@jwt_required()
def get_geographies():
    """Get available geography values."""
    from ..models import FilterDimension
    user = get_current_user()
    dims = FilterDimension.query.filter_by(dimension_type='geography', is_active=True).filter(
        db.or_(FilterDimension.organization_id == None, FilterDimension.organization_id == user.organization_id if user else False)
    ).order_by(FilterDimension.sort_order).all()
    return jsonify({'geographies': [d.to_dict() for d in dims]})


@profiles_bp.route('/dimensions/client-types', methods=['GET'])
@jwt_required()
def get_client_types():
    """Get available client type values."""
    from ..models import FilterDimension
    user = get_current_user()
    dims = FilterDimension.query.filter_by(dimension_type='client_type', is_active=True).filter(
        db.or_(FilterDimension.organization_id == None, FilterDimension.organization_id == user.organization_id if user else False)
    ).order_by(FilterDimension.sort_order).all()
    return jsonify({'client_types': [d.to_dict() for d in dims]})


@profiles_bp.route('/dimensions/currencies', methods=['GET'])
@jwt_required()
def get_currencies():
    """Get available currency values."""
    from ..models import FilterDimension
    user = get_current_user()
    dims = FilterDimension.query.filter_by(dimension_type='currency', is_active=True).filter(
        db.or_(FilterDimension.organization_id == None, FilterDimension.organization_id == user.organization_id if user else False)
    ).order_by(FilterDimension.sort_order).all()
    return jsonify({'currencies': [d.to_dict() for d in dims]})


@profiles_bp.route('/dimensions/industries', methods=['GET'])
@jwt_required()
def get_industries():
    """Get available industry values."""
    from ..models import FilterDimension
    user = get_current_user()
    dims = FilterDimension.query.filter_by(dimension_type='industry', is_active=True).filter(
        db.or_(FilterDimension.organization_id == None, FilterDimension.organization_id == user.organization_id if user else False)
    ).order_by(FilterDimension.sort_order).all()
    return jsonify({'industries': [d.to_dict() for d in dims]})


@profiles_bp.route('/dimensions/compliance', methods=['GET'])
@jwt_required()
def get_compliance_frameworks():
    """Get available compliance framework values."""
    from ..models import FilterDimension
    user = get_current_user()
    dims = FilterDimension.query.filter_by(dimension_type='compliance', is_active=True).filter(
        db.or_(FilterDimension.organization_id == None, FilterDimension.organization_id == user.organization_id if user else False)
    ).order_by(FilterDimension.sort_order).all()
    return jsonify({'compliance_frameworks': [d.to_dict() for d in dims]})

