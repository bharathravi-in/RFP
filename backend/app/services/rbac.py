"""
Role-based Access Control (RBAC) utilities and decorators.

Tenant-scoped roles (within organization only):
- owner: Billing, users, settings, full control
- admin: Full access to all features
- editor: Can edit projects and answers
- reviewer: Can review and approve answers
- viewer: Read-only access
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from ..models import User


# Role hierarchy: owner > admin > editor > reviewer > viewer
ROLE_HIERARCHY = {
    'owner': 5,
    'admin': 4,
    'editor': 3,
    'reviewer': 2,
    'viewer': 1
}

# Permission mappings for specific actions
PERMISSIONS = {
    'manage_billing': ['owner'],
    'manage_organization': ['owner', 'admin'],
    'manage_users': ['owner', 'admin'],
    'invite_users': ['owner', 'admin', 'editor'],
    'approve_answers': ['owner', 'admin', 'reviewer'],
    'edit_sections': ['owner', 'admin', 'editor'],
    'delete_projects': ['owner', 'admin'],
    'export_documents': ['owner', 'admin', 'editor', 'reviewer'],
    'view_analytics': ['owner', 'admin', 'editor'],
    'manage_webhooks': ['owner', 'admin'],
    'manage_ai_config': ['owner', 'admin'],
}


def get_current_user():
    """Get the current authenticated user from JWT."""
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.get(user_id)


def has_role(user, required_roles):
    """Check if user has one of the required roles."""
    if not user:
        return False
    if isinstance(required_roles, str):
        required_roles = [required_roles]
    return user.role in required_roles


def has_permission(user, permission):
    """Check if user has a specific permission."""
    if not user:
        return False
    allowed_roles = PERMISSIONS.get(permission, [])
    return user.role in allowed_roles


def require_role(*roles):
    """
    Decorator to require specific role(s) for a route.
    
    Usage:
        @bp.route('/admin-only')
        @jwt_required()
        @require_role('admin')
        def admin_only():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            if not has_role(user, roles):
                return jsonify({
                    'error': 'Permission denied',
                    'message': f'This action requires one of these roles: {", ".join(roles)}',
                    'required_roles': list(roles),
                    'your_role': user.role
                }), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_permission(permission):
    """
    Decorator to require a specific permission for a route.
    
    Usage:
        @bp.route('/approve/<int:id>')
        @jwt_required()
        @require_permission('approve_answers')
        def approve_answer(id):
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            if not has_permission(user, permission):
                allowed = PERMISSIONS.get(permission, [])
                return jsonify({
                    'error': 'Permission denied',
                    'message': f'You do not have permission to: {permission}',
                    'required_roles': allowed,
                    'your_role': user.role
                }), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_admin(fn):
    """Shorthand decorator for admin-only routes."""
    return require_role('admin')(fn)


def require_editor_or_admin(fn):
    """Shorthand decorator for editor/admin routes."""
    return require_role('admin', 'editor')(fn)
