"""
CRM Integration Routes

Handles inbound webhooks from CRM platforms:
- Salesforce Opportunity webhooks
- HubSpot Deal webhooks
- Generic CRM webhooks

These endpoints receive data from external CRMs and create/update projects.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Organization
from ..services.crm_integration_service import get_crm_integration_service
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('integrations', __name__, url_prefix='/api/integrations')


# ================================
# Salesforce Webhooks
# ================================

@bp.route('/salesforce/webhook', methods=['POST'])
def salesforce_webhook():
    """
    Receive Salesforce Opportunity webhooks.
    
    Salesforce can send webhooks via:
    - Outbound Messages (SOAP)
    - Platform Events
    - Change Data Capture
    
    Expected payload format:
    {
        "sObject": {
            "Id": "0061234567890ABCDEF",
            "Name": "Opportunity Name",
            "StageName": "Proposal/Price Quote",
            "Amount": 50000,
            "CloseDate": "2024-03-15",
            "Account": {"Name": "Client Company"},
            "Description": "..."
        }
    }
    """
    try:
        # Get organization from header or query param
        org_identifier = request.headers.get('X-Organization-Id') or request.args.get('org_id')
        
        if not org_identifier:
            return jsonify({'error': 'Organization identifier required'}), 400
        
        # Find organization
        org = Organization.query.filter(
            db.or_(
                Organization.id == org_identifier if org_identifier.isdigit() else False,
                Organization.slug == org_identifier
            )
        ).first()
        
        if not org:
            return jsonify({'error': 'Organization not found'}), 404
        
        # Verify signature if configured
        org_settings = org.settings or {}
        sf_secret = org_settings.get('salesforce_webhook_secret')
        
        if sf_secret:
            signature = request.headers.get('X-Salesforce-Signature', '')
            service = get_crm_integration_service(org.id)
            if not service.verify_salesforce_signature(request.data, signature, sf_secret):
                logger.warning(f"Invalid Salesforce signature for org {org.id}")
                return jsonify({'error': 'Invalid signature'}), 401
        
        # Process the webhook
        data = request.get_json()
        service = get_crm_integration_service(org.id)
        
        result = service.process_salesforce_opportunity(data)
        
        if not result.get('success'):
            return jsonify({'error': result.get('error', 'Processing failed')}), 400
        
        # Create or update project
        project_result = service.create_or_update_project(result['project_data'])
        
        if not project_result.get('success'):
            return jsonify({'error': project_result.get('error', 'Project sync failed')}), 500
        
        logger.info(f"Salesforce webhook processed: {project_result.get('action')} project {project_result.get('project_id')}")
        
        return jsonify({
            'success': True,
            'action': project_result.get('action'),
            'project_id': project_result.get('project_id')
        }), 200
        
    except Exception as e:
        logger.error(f"Salesforce webhook error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ================================
# HubSpot Webhooks
# ================================

@bp.route('/hubspot/webhook', methods=['POST'])
def hubspot_webhook():
    """
    Receive HubSpot Deal webhooks.
    
    HubSpot can send webhooks via:
    - Workflow actions
    - Native webhooks (API)
    
    Expected payload format:
    {
        "id": "12345678",
        "properties": {
            "dealname": "Deal Name",
            "dealstage": "contractsent",
            "amount": "50000",
            "closedate": "2024-03-15",
            "company_name": "Client Company",
            "description": "..."
        }
    }
    """
    try:
        # Get organization from header or query param
        org_identifier = request.headers.get('X-Organization-Id') or request.args.get('org_id')
        
        if not org_identifier:
            return jsonify({'error': 'Organization identifier required'}), 400
        
        # Find organization
        org = Organization.query.filter(
            db.or_(
                Organization.id == org_identifier if str(org_identifier).isdigit() else False,
                Organization.slug == org_identifier
            )
        ).first()
        
        if not org:
            return jsonify({'error': 'Organization not found'}), 404
        
        # Verify signature if configured
        org_settings = org.settings or {}
        hs_secret = org_settings.get('hubspot_webhook_secret')
        
        if hs_secret:
            signature = request.headers.get('X-HubSpot-Signature-v3', '')
            service = get_crm_integration_service(org.id)
            if not service.verify_hubspot_signature(request.data, signature, hs_secret):
                logger.warning(f"Invalid HubSpot signature for org {org.id}")
                return jsonify({'error': 'Invalid signature'}), 401
        
        # Process the webhook
        data = request.get_json()
        
        # HubSpot may send array of events
        if isinstance(data, list):
            results = []
            for item in data:
                service = get_crm_integration_service(org.id)
                result = service.process_hubspot_deal(item)
                if result.get('success'):
                    project_result = service.create_or_update_project(result['project_data'])
                    results.append(project_result)
            return jsonify({'success': True, 'results': results}), 200
        
        # Single event
        service = get_crm_integration_service(org.id)
        result = service.process_hubspot_deal(data)
        
        if not result.get('success'):
            return jsonify({'error': result.get('error', 'Processing failed')}), 400
        
        # Create or update project
        project_result = service.create_or_update_project(result['project_data'])
        
        if not project_result.get('success'):
            return jsonify({'error': project_result.get('error', 'Project sync failed')}), 500
        
        logger.info(f"HubSpot webhook processed: {project_result.get('action')} project {project_result.get('project_id')}")
        
        return jsonify({
            'success': True,
            'action': project_result.get('action'),
            'project_id': project_result.get('project_id')
        }), 200
        
    except Exception as e:
        logger.error(f"HubSpot webhook error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ================================
# Integration Settings (Admin)
# ================================

@bp.route('/settings', methods=['GET'])
@jwt_required()
def get_integration_settings():
    """Get current integration settings for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 400
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    org = Organization.query.get(user.organization_id)
    settings = org.settings or {}
    
    return jsonify({
        'integrations': {
            'salesforce': {
                'enabled': bool(settings.get('salesforce_enabled')),
                'webhook_url': f"/api/integrations/salesforce/webhook?org_id={org.id}",
                'has_secret': bool(settings.get('salesforce_webhook_secret'))
            },
            'hubspot': {
                'enabled': bool(settings.get('hubspot_enabled')),
                'webhook_url': f"/api/integrations/hubspot/webhook?org_id={org.id}",
                'has_secret': bool(settings.get('hubspot_webhook_secret'))
            }
        }
    })


@bp.route('/settings', methods=['PUT'])
@jwt_required()
def update_integration_settings():
    """Update integration settings for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 400
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    org = Organization.query.get(user.organization_id)
    data = request.get_json()
    
    settings = org.settings or {}
    
    # Update Salesforce settings
    if 'salesforce' in data:
        sf = data['salesforce']
        if 'enabled' in sf:
            settings['salesforce_enabled'] = sf['enabled']
        if 'webhook_secret' in sf:
            settings['salesforce_webhook_secret'] = sf['webhook_secret']
    
    # Update HubSpot settings
    if 'hubspot' in data:
        hs = data['hubspot']
        if 'enabled' in hs:
            settings['hubspot_enabled'] = hs['enabled']
        if 'webhook_secret' in hs:
            settings['hubspot_webhook_secret'] = hs['webhook_secret']
    
    org.settings = settings
    db.session.commit()
    
    return jsonify({
        'message': 'Integration settings updated',
        'success': True
    })


# ================================
# Health Check
# ================================

@bp.route('/health', methods=['GET'])
def health():
    """Health check for integration endpoints."""
    return jsonify({
        'status': 'ok',
        'service': 'crm-integrations',
        'supported': ['salesforce', 'hubspot']
    })
