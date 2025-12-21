"""
User profile routes for managing user settings and profile photo.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User
import base64

bp = Blueprint('users', __name__)


@bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user's profile."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user.to_dict()}), 200


@bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user's profile (name, email)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Update name if provided
    if 'name' in data:
        user.name = data['name']
    
    # Update email if provided (check for duplicates)
    if 'email' in data and data['email'] != user.email:
        existing = User.query.filter_by(email=data['email']).first()
        if existing:
            return jsonify({'error': 'Email already in use'}), 409
        user.email = data['email']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': user.to_dict()
    }), 200


@bp.route('/profile/photo', methods=['POST'])
@jwt_required()
def upload_photo():
    """Upload profile photo (base64 encoded)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if file was uploaded
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if ext not in allowed_extensions:
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
        
        # Read and encode as base64
        file_content = file.read()
        if len(file_content) > 5 * 1024 * 1024:  # 5MB limit
            return jsonify({'error': 'File too large. Maximum 5MB'}), 400
        
        mime_type = f'image/{ext}' if ext != 'jpg' else 'image/jpeg'
        base64_data = base64.b64encode(file_content).decode('utf-8')
        user.profile_photo = f'data:{mime_type};base64,{base64_data}'
    
    # Check if base64 data was sent directly
    elif request.is_json:
        data = request.get_json()
        if 'photo' in data:
            user.profile_photo = data['photo']
        else:
            return jsonify({'error': 'No photo data provided'}), 400
    else:
        return jsonify({'error': 'No photo data provided'}), 400
    
    db.session.commit()
    
    return jsonify({
        'message': 'Photo uploaded successfully',
        'user': user.to_dict()
    }), 200


@bp.route('/profile/photo', methods=['DELETE'])
@jwt_required()
def remove_photo():
    """Remove profile photo."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.profile_photo = None
    db.session.commit()
    
    return jsonify({
        'message': 'Photo removed successfully',
        'user': user.to_dict()
    }), 200


@bp.route('/profile/password', methods=['PUT'])
@jwt_required()
def change_password():
    """Change user password."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if not data.get('current_password') or not data.get('new_password'):
        return jsonify({'error': 'Current and new password required'}), 400
    
    if not user.check_password(data['current_password']):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    if len(data['new_password']) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    user.set_password(data['new_password'])
    db.session.commit()
    
    return jsonify({'message': 'Password changed successfully'}), 200
