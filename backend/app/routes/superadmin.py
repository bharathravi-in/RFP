"""
Super Admin API routes for platform-level administration.

Super admins can:
- Manage all organizations' subscriptions
- Enable/disable features for tenants
- Extend trials
- View platform statistics
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from datetime import datetime, timedelta
from ..extensions import db
from ..models import User, Organization


bp = Blueprint('superadmin', __name__, url_prefix='/api/superadmin')


def require_super_admin(fn):
    """Decorator to require super admin access."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(int(user_id))
        
        if not user or not user.is_super_admin:
            return jsonify({
                'error': 'Access denied',
                'message': 'Super admin privileges required'
            }), 403
        
        return fn(*args, **kwargs)
    return wrapper


# ===============================
# Organization Management
# ===============================

@bp.route('/organizations', methods=['GET'])
@jwt_required()
@require_super_admin
def list_all_organizations():
    """List all organizations with subscription status."""
    organizations = Organization.query.order_by(Organization.created_at.desc()).all()
    
    return jsonify({
        'organizations': [org.to_dict() for org in organizations],
        'total': len(organizations)
    })


@bp.route('/organizations/<int:org_id>', methods=['GET'])
@jwt_required()
@require_super_admin
def get_organization_details(org_id):
    """Get detailed organization info."""
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    result = org.to_dict()
    result['users'] = [u.to_dict() for u in org.users]
    
    return jsonify({'organization': result})


@bp.route('/organizations/<int:org_id>/subscription', methods=['PUT'])
@jwt_required()
@require_super_admin
def update_subscription(org_id):
    """Update organization subscription and feature flags."""
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    data = request.get_json()
    
    # Update subscription plan
    if 'plan' in data:
        valid_plans = ['trial', 'starter', 'professional', 'enterprise']
        if data['plan'] not in valid_plans:
            return jsonify({'error': f'Invalid plan. Must be one of: {valid_plans}'}), 400
        org.subscription_plan = data['plan']
        
        # Auto-set limits based on plan
        if data['plan'] == 'enterprise':
            org.max_users = -1
            org.max_projects = -1
            org.max_documents = -1
        elif data['plan'] == 'professional':
            org.max_users = 50
            org.max_projects = 100
            org.max_documents = 1000
        elif data['plan'] == 'starter':
            org.max_users = 10
            org.max_projects = 25
            org.max_documents = 200
    
    # Update subscription status
    if 'status' in data:
        valid_statuses = ['trialing', 'active', 'canceled', 'expired']
        if data['status'] not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400
        org.subscription_status = data['status']
    
    # Update limits manually
    if 'max_users' in data:
        org.max_users = data['max_users']
    if 'max_projects' in data:
        org.max_projects = data['max_projects']
    if 'max_documents' in data:
        org.max_documents = data['max_documents']
    
    # Update feature flags
    if 'feature_flags' in data:
        org.feature_flags = data['feature_flags']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Subscription updated',
        'organization': org.to_dict()
    })


@bp.route('/organizations/<int:org_id>/features', methods=['PUT'])
@jwt_required()
@require_super_admin
def update_features(org_id):
    """Enable/disable specific features for an organization."""
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    data = request.get_json()
    
    # Get current feature flags
    flags = org.feature_flags or {}
    
    # Update features
    for feature, enabled in data.items():
        flags[feature] = enabled
    
    org.feature_flags = flags
    db.session.commit()
    
    return jsonify({
        'message': 'Features updated',
        'feature_flags': org.feature_flags
    })


@bp.route('/organizations/<int:org_id>/extend-trial', methods=['POST'])
@jwt_required()
@require_super_admin
def extend_trial(org_id):
    """Extend organization trial period."""
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    data = request.get_json()
    days = data.get('days', 14)
    
    if org.trial_ends_at and org.trial_ends_at > datetime.utcnow():
        org.trial_ends_at = org.trial_ends_at + timedelta(days=days)
    else:
        org.trial_ends_at = datetime.utcnow() + timedelta(days=days)
    
    org.subscription_status = 'trialing'
    org.subscription_plan = 'trial'
    
    db.session.commit()
    
    return jsonify({
        'message': f'Trial extended by {days} days',
        'trial_ends_at': org.trial_ends_at.isoformat(),
        'trial_days_remaining': org.trial_days_remaining
    })


# ===============================
# User Management
# ===============================

@bp.route('/users', methods=['GET'])
@jwt_required()
@require_super_admin
def list_all_users():
    """List all users across all organizations."""
    users = User.query.order_by(User.created_at.desc()).all()
    
    return jsonify({
        'users': [u.to_dict() for u in users],
        'total': len(users)
    })


@bp.route('/users/<int:user_id>/toggle-super-admin', methods=['POST'])
@jwt_required()
@require_super_admin
def toggle_super_admin(user_id):
    """Toggle super admin status for a user."""
    current_user_id = int(get_jwt_identity())
    
    if user_id == current_user_id:
        return jsonify({'error': 'Cannot modify your own super admin status'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.is_super_admin = not user.is_super_admin
    db.session.commit()
    
    return jsonify({
        'message': f'Super admin {"granted" if user.is_super_admin else "revoked"}',
        'user': user.to_dict()
    })


# ===============================
# Platform Stats
# ===============================

@bp.route('/stats', methods=['GET'])
@jwt_required()
@require_super_admin
def platform_stats():
    """Get platform-wide statistics."""
    from ..models import Project, Document
    
    return jsonify({
        'total_organizations': Organization.query.count(),
        'total_users': User.query.count(),
        'total_projects': Project.query.count(),
        'total_documents': Document.query.count(),
        'trialing': Organization.query.filter_by(subscription_status='trialing').count(),
        'active': Organization.query.filter_by(subscription_status='active').count(),
        'expired': Organization.query.filter_by(subscription_status='expired').count(),
        'plans': {
            'trial': Organization.query.filter_by(subscription_plan='trial').count(),
            'starter': Organization.query.filter_by(subscription_plan='starter').count(),
            'professional': Organization.query.filter_by(subscription_plan='professional').count(),
            'enterprise': Organization.query.filter_by(subscription_plan='enterprise').count(),
        }
    })


# ===============================
# Available Features
# ===============================

AVAILABLE_FEATURES = {
    'ai_chat': 'AI Chat & Copilot',
    'advanced_agents': 'Advanced AI Agents',
    'export_docx': 'Export to Word',
    'export_pptx': 'Export to PowerPoint',
    'export_xlsx': 'Export to Excel',
    'webhooks': 'Webhook Integrations',
    'api_access': 'API Access',
    'analytics': 'Analytics Dashboard',
    'compliance': 'Compliance Matrix',
    'knowledge_base': 'Knowledge Base',
    'collaboration': 'Team Collaboration',
    'version_history': 'Version History',
    'custom_branding': 'Custom Branding',
}


@bp.route('/features', methods=['GET'])
@jwt_required()
@require_super_admin
def list_features():
    """List all available features that can be toggled."""
    return jsonify({'features': AVAILABLE_FEATURES})


@bp.route('/plans', methods=['GET'])
@jwt_required()
@require_super_admin
def list_plans():
    """List subscription plans and their default features."""
    plans = {
        'trial': {
            'name': 'Free Trial',
            'max_users': 5,
            'max_projects': 10,
            'max_documents': 50,
            'features': ['ai_chat', 'export_docx', 'knowledge_base']
        },
        'starter': {
            'name': 'Starter',
            'max_users': 10,
            'max_projects': 25,
            'max_documents': 200,
            'features': ['ai_chat', 'export_docx', 'export_pptx', 'knowledge_base', 'collaboration']
        },
        'professional': {
            'name': 'Professional',
            'max_users': 50,
            'max_projects': 100,
            'max_documents': 1000,
            'features': ['ai_chat', 'advanced_agents', 'export_docx', 'export_pptx', 'export_xlsx', 
                        'knowledge_base', 'collaboration', 'analytics', 'api_access']
        },
        'enterprise': {
            'name': 'Enterprise',
            'max_users': -1,
            'max_projects': -1,
            'max_documents': -1,
            'features': list(AVAILABLE_FEATURES.keys())
        }
    }
    return jsonify({'plans': plans})
