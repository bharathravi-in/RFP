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
        # Start 14-day free trial
        organization.start_trial(days=14)
        db.session.add(organization)
        db.session.flush()  # Get org ID before creating user
    
    # Create user - first user of org becomes owner
    user = User(
        email=data['email'],
        name=data['name'],
        role='owner' if organization else data.get('role', 'viewer'),
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
    
    response = {
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }
    
    if user.organization:
        response['organization'] = user.organization.to_dict()
    
    return jsonify(response), 200


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


@bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset email."""
    import secrets
    from datetime import datetime, timedelta
    from flask import current_app
    from ..services.email_service import get_email_service
    
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    # Always return success to prevent email enumeration attacks
    user = User.query.filter_by(email=email).first()
    
    if user and user.is_active:
        # Generate reset token
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()
        
        # Build reset URL
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        reset_link = f"{frontend_url}/reset-password?token={token}"
        
        # Send email
        try:
            email_service = get_email_service()
            email_service.send_password_reset(
                to=user.email,
                user_name=user.name,
                reset_link=reset_link
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send password reset email: {e}")
    
    # Always return success message
    return jsonify({
        'message': 'If an account exists with this email, you will receive password reset instructions.'
    }), 200


@bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password with token."""
    data = request.get_json()
    
    token = data.get('token')
    new_password = data.get('password')
    
    if not token or not new_password:
        return jsonify({'error': 'Token and password are required'}), 400
    
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    # Find user by reset token
    user = User.query.filter_by(password_reset_token=token).first()
    
    if not user:
        return jsonify({'error': 'Invalid or expired reset token'}), 400
    
    # Check if token is expired
    from datetime import datetime as dt
    if user.password_reset_expires and user.password_reset_expires < dt.utcnow():
        return jsonify({'error': 'Reset token has expired. Please request a new one.'}), 400
    
    # Update password
    user.set_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.session.commit()
    
    return jsonify({'message': 'Password has been reset successfully. You can now log in.'}), 200

