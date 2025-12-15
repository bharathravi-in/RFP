from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token,
    jwt_required, 
    get_jwt_identity
)
from ..extensions import db
from ..models import User, Organization

bp = Blueprint('auth', __name__)


@bp.route('/register', methods=['POST'])
def register():
    """Register a new user and optionally create organization."""
    data = request.get_json()
    
    # Validate required fields
    required = ['email', 'password', 'name']
    if not all(field in data for field in required):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Check if user exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    # Create organization if provided
    organization = None
    if data.get('organization_name'):
        slug = data['organization_name'].lower().replace(' ', '-')
        organization = Organization(
            name=data['organization_name'],
            slug=slug,
            settings={}
        )
        db.session.add(organization)
        db.session.flush()  # Get org ID before creating user
    
    # Create user
    user = User(
        email=data['email'],
        name=data['name'],
        role=data.get('role', 'admin' if organization else 'viewer'),
        organization_id=organization.id if organization else None
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    # Generate tokens (identity must be string)
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict(),
        'organization': organization.to_dict() if organization else None,
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201


@bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return tokens."""
    data = request.get_json()
    
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403
    
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    return jsonify({
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 200


@bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user info."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    response = user.to_dict()
    if user.organization:
        response['organization'] = user.organization.to_dict()
    
    return jsonify(response), 200


@bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token."""
    user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(user_id))
    return jsonify({'access_token': access_token}), 200


@bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (client should discard tokens)."""
    # In a production app, you'd add the token to a blocklist
    return jsonify({'message': 'Logged out successfully'}), 200
