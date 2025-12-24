"""Invitation routes for team member management."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.organization import Organization
from app.models.invitation import Invitation

bp = Blueprint('invitations', __name__, url_prefix='/api/invitations')


@bp.route('', methods=['GET'], strict_slashes=False)
@bp.route('/', methods=['GET'], strict_slashes=False)
@jwt_required()
def list_invitations():
    """List invitations for the current user's organization."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'invitations': []}), 200
    
    # Get pending invitations for the organization
    invitations = Invitation.query.filter_by(
        organization_id=user.organization_id
    ).order_by(Invitation.created_at.desc()).all()
    
    return jsonify({
        'invitations': [inv.to_dict() for inv in invitations]
    }), 200


@bp.route('', methods=['POST'], strict_slashes=False)
@bp.route('/', methods=['POST'], strict_slashes=False)
@jwt_required()
def create_invitation():
    """Create a new invitation to join the organization."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.organization_id:
        return jsonify({'error': 'You must belong to an organization to invite members'}), 400
    
    if user.role != 'admin':
        return jsonify({'error': 'Only admins can invite members'}), 403
    
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    role = data.get('role', 'viewer')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    # Validate role
    valid_roles = ['admin', 'editor', 'reviewer', 'viewer']
    if role not in valid_roles:
        return jsonify({'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'}), 400
    
    # Check if user already exists in the organization
    existing_user = User.query.filter_by(email=email, organization_id=user.organization_id).first()
    if existing_user:
        return jsonify({'error': 'User is already a member of this organization'}), 400
    
    # Check for existing pending invitation
    existing_invitation = Invitation.query.filter_by(
        email=email,
        organization_id=user.organization_id,
        status='pending'
    ).first()
    
    if existing_invitation:
        if existing_invitation.is_expired:
            # Regenerate token for expired invitation
            existing_invitation.regenerate_token()
            db.session.commit()
            return jsonify({
                'message': 'Invitation resent',
                'invitation': existing_invitation.to_dict()
            }), 200
        else:
            return jsonify({'error': 'An invitation is already pending for this email'}), 400
    
    # Create new invitation
    invitation = Invitation(
        email=email,
        organization_id=user.organization_id,
        invited_by=user.id,
        role=role
    )
    
    db.session.add(invitation)
    db.session.commit()
    
    # Send invitation email
    from flask import current_app
    from app.services.email_service import get_email_service
    
    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
    invite_link = f"{frontend_url}/accept-invite?token={invitation.token}"
    
    email_sent = False
    try:
        email_service = get_email_service()
        email_sent = email_service.send_team_invitation(
            to=email,
            inviter_name=user.name,
            organization_name=user.organization.name,
            role=role,
            invite_link=invite_link
        )
    except Exception as e:
        # Log error but don't fail the invitation creation
        import logging
        logging.error(f"Failed to send invitation email: {e}")
    
    return jsonify({
        'message': 'Invitation sent successfully',
        'invitation': invitation.to_dict(),
        'invite_link': invite_link,
        'email_sent': email_sent
    }), 201


@bp.route('/<int:invitation_id>/resend', methods=['POST'])
@jwt_required()
def resend_invitation(invitation_id):
    """Resend an invitation with a new token."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    invitation = Invitation.query.get(invitation_id)
    
    if not invitation:
        return jsonify({'error': 'Invitation not found'}), 404
    
    if invitation.organization_id != user.organization_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if invitation.status == 'accepted':
        return jsonify({'error': 'Invitation has already been accepted'}), 400
    
    invitation.regenerate_token()
    db.session.commit()
    
    return jsonify({
        'message': 'Invitation resent',
        'invitation': invitation.to_dict()
    }), 200


@bp.route('/<int:invitation_id>', methods=['DELETE'])
@jwt_required()
def cancel_invitation(invitation_id):
    """Cancel a pending invitation."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    invitation = Invitation.query.get(invitation_id)
    
    if not invitation:
        return jsonify({'error': 'Invitation not found'}), 404
    
    if invitation.organization_id != user.organization_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if invitation.status == 'accepted':
        return jsonify({'error': 'Cannot cancel an accepted invitation'}), 400
    
    invitation.cancel()
    db.session.commit()
    
    return jsonify({'message': 'Invitation cancelled'}), 200


@bp.route('/accept', methods=['POST'])
def accept_invitation():
    """Accept an invitation (can be called without auth for new users)."""
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'Invitation token is required'}), 400
    
    invitation = Invitation.query.filter_by(token=token).first()
    
    if not invitation:
        return jsonify({'error': 'Invalid invitation token'}), 404
    
    if invitation.status == 'accepted':
        return jsonify({'error': 'Invitation has already been accepted'}), 400
    
    if invitation.status == 'cancelled':
        return jsonify({'error': 'Invitation has been cancelled'}), 400
    
    if invitation.is_expired:
        return jsonify({'error': 'Invitation has expired'}), 400
    
    # Check if user already exists
    existing_user = User.query.filter_by(email=invitation.email).first()
    
    if existing_user:
        # Update existing user's organization
        if existing_user.organization_id:
            return jsonify({'error': 'User already belongs to an organization'}), 400
        
        existing_user.organization_id = invitation.organization_id
        existing_user.role = invitation.role
        invitation.accept()
        db.session.commit()
        
        return jsonify({
            'message': 'Invitation accepted',
            'user_exists': True,
            'requires_login': True
        }), 200
    else:
        # New user needs to register
        # Return info needed for registration
        return jsonify({
            'message': 'Invitation valid',
            'user_exists': False,
            'requires_registration': True,
            'email': invitation.email,
            'organization_name': invitation.organization.name,
            'role': invitation.role
        }), 200


@bp.route('/accept/register', methods=['POST'])
def accept_and_register():
    """Accept invitation and create new user account."""
    data = request.get_json()
    token = data.get('token')
    name = data.get('name')
    password = data.get('password')
    
    if not all([token, name, password]):
        return jsonify({'error': 'Token, name, and password are required'}), 400
    
    invitation = Invitation.query.filter_by(token=token).first()
    
    if not invitation:
        return jsonify({'error': 'Invalid invitation token'}), 404
    
    if not invitation.is_valid:
        return jsonify({'error': 'Invitation is no longer valid'}), 400
    
    # Check if user already exists
    if User.query.filter_by(email=invitation.email).first():
        return jsonify({'error': 'User with this email already exists'}), 400
    
    # Create new user
    user = User(
        email=invitation.email,
        name=name,
        role=invitation.role,
        organization_id=invitation.organization_id
    )
    user.set_password(password)
    
    db.session.add(user)
    invitation.accept()
    db.session.commit()
    
    # Generate tokens for immediate login
    from flask_jwt_extended import create_access_token, create_refresh_token
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        'message': 'Account created successfully',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201


@bp.route('/validate/<token>', methods=['GET'])
def validate_token(token):
    """Validate an invitation token without auth."""
    invitation = Invitation.query.filter_by(token=token).first()
    
    if not invitation:
        return jsonify({'valid': False, 'error': 'Invalid token'}), 404
    
    if not invitation.is_valid:
        return jsonify({
            'valid': False,
            'error': 'Invitation expired or cancelled',
            'status': invitation.status
        }), 400
    
    return jsonify({
        'valid': True,
        'email': invitation.email,
        'organization_name': invitation.organization.name,
        'role': invitation.role,
        'expires_at': invitation.expires_at.isoformat()
    }), 200
