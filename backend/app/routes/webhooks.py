"""
Webhook API routes for managing organization webhooks.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User
from ..models.webhook import WebhookConfig, WebhookDelivery, WEBHOOK_EVENTS
from ..services.rbac import require_role
import secrets

bp = Blueprint('webhooks', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
@require_role('admin')
def list_webhooks():
    """List all webhooks for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 400
    
    webhooks = WebhookConfig.query.filter_by(
        organization_id=user.organization_id
    ).order_by(WebhookConfig.created_at.desc()).all()
    
    return jsonify({
        'webhooks': [w.to_dict() for w in webhooks],
        'total': len(webhooks)
    })


@bp.route('', methods=['POST'])
@jwt_required()
@require_role('admin')
def create_webhook():
    """Create a new webhook configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 400
    
    data = request.get_json()
    
    # Validate required fields
    name = data.get('name', '').strip()
    url = data.get('url', '').strip()
    events = data.get('events', [])
    
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    if not url.startswith('https://'):
        return jsonify({'error': 'URL must use HTTPS'}), 400
    
    # Validate events
    invalid_events = [e for e in events if e not in WEBHOOK_EVENTS]
    if invalid_events:
        return jsonify({'error': f'Invalid events: {invalid_events}'}), 400
    
    # Generate secret for signature verification
    secret = secrets.token_hex(32)
    
    webhook = WebhookConfig(
        organization_id=user.organization_id,
        name=name,
        url=url,
        secret=secret,
        events=events,
        is_active=data.get('is_active', True)
    )
    
    db.session.add(webhook)
    db.session.commit()
    
    return jsonify({
        'message': 'Webhook created',
        'webhook': webhook.to_dict(),
        'secret': secret  # Only returned once on creation
    }), 201


@bp.route('/<int:webhook_id>', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_webhook(webhook_id):
    """Get a specific webhook configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    webhook = WebhookConfig.query.get(webhook_id)
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    if webhook.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({'webhook': webhook.to_dict()})


@bp.route('/<int:webhook_id>', methods=['PUT'])
@jwt_required()
@require_role('admin')
def update_webhook(webhook_id):
    """Update a webhook configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    webhook = WebhookConfig.query.get(webhook_id)
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    if webhook.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        webhook.name = data['name'].strip()
    if 'url' in data:
        url = data['url'].strip()
        if not url.startswith('https://'):
            return jsonify({'error': 'URL must use HTTPS'}), 400
        webhook.url = url
    if 'events' in data:
        invalid_events = [e for e in data['events'] if e not in WEBHOOK_EVENTS]
        if invalid_events:
            return jsonify({'error': f'Invalid events: {invalid_events}'}), 400
        webhook.events = data['events']
    if 'is_active' in data:
        webhook.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Webhook updated',
        'webhook': webhook.to_dict()
    })


@bp.route('/<int:webhook_id>', methods=['DELETE'])
@jwt_required()
@require_role('admin')
def delete_webhook(webhook_id):
    """Delete a webhook configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    webhook = WebhookConfig.query.get(webhook_id)
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    if webhook.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(webhook)
    db.session.commit()
    
    return jsonify({'message': 'Webhook deleted'})


@bp.route('/<int:webhook_id>/regenerate-secret', methods=['POST'])
@jwt_required()
@require_role('admin')
def regenerate_secret(webhook_id):
    """Regenerate the webhook signing secret."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    webhook = WebhookConfig.query.get(webhook_id)
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    if webhook.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    new_secret = secrets.token_hex(32)
    webhook.secret = new_secret
    db.session.commit()
    
    return jsonify({
        'message': 'Secret regenerated',
        'secret': new_secret
    })


@bp.route('/<int:webhook_id>/deliveries', methods=['GET'])
@jwt_required()
@require_role('admin')
def list_deliveries(webhook_id):
    """List recent deliveries for a webhook."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    webhook = WebhookConfig.query.get(webhook_id)
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    if webhook.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    limit = request.args.get('limit', 50, type=int)
    
    deliveries = WebhookDelivery.query.filter_by(
        webhook_id=webhook_id
    ).order_by(WebhookDelivery.created_at.desc()).limit(limit).all()
    
    return jsonify({
        'deliveries': [d.to_dict() for d in deliveries],
        'total': len(deliveries)
    })


@bp.route('/events', methods=['GET'])
@jwt_required()
def list_events():
    """List all available webhook event types."""
    return jsonify({
        'events': [
            {'type': k, 'description': v}
            for k, v in WEBHOOK_EVENTS.items()
        ]
    })


@bp.route('/<int:webhook_id>/test', methods=['POST'])
@jwt_required()
@require_role('admin')
def test_webhook(webhook_id):
    """Send a test webhook delivery."""
    from ..services.webhook_dispatcher import webhook_dispatcher
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    webhook = WebhookConfig.query.get(webhook_id)
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    if webhook.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Send test payload
    test_payload = {
        'event': 'test',
        'timestamp': int(__import__('time').time()),
        'message': 'This is a test webhook from RFP Pro',
        'organization_id': user.organization_id
    }
    
    result = webhook_dispatcher._deliver(webhook, 'test', test_payload)
    
    return jsonify({
        'message': 'Test webhook sent',
        'result': result
    })
