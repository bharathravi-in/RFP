"""
CRM Integration Routes for Salesforce and HubSpot.
"""
from flask import Blueprint, request, jsonify, redirect, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import secrets
import urllib.parse

from ..extensions import db
from ..models import User, Project, CRMIntegration, CRMSyncRecord, CRMSyncLog

bp = Blueprint('crm', __name__)


# =============================================================================
# CRM INTEGRATION CONFIGURATION
# =============================================================================

@bp.route('/integrations', methods=['GET'])
@jwt_required()
def list_integrations():
    """List all CRM integrations for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    integrations = CRMIntegration.query.filter_by(
        organization_id=user.organization_id
    ).all()
    
    return jsonify({
        'integrations': [i.to_dict() for i in integrations]
    }), 200


@bp.route('/integrations', methods=['POST'])
@jwt_required()
def create_integration():
    """Create a new CRM integration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    crm_type = data.get('crm_type')
    
    if crm_type not in ['salesforce', 'hubspot', 'pipedrive', 'zoho']:
        return jsonify({'error': 'Invalid CRM type'}), 400
    
    # Check if integration already exists
    existing = CRMIntegration.query.filter_by(
        organization_id=user.organization_id,
        crm_type=crm_type
    ).first()
    
    if existing:
        return jsonify({'error': f'{crm_type} integration already exists'}), 400
    
    integration = CRMIntegration(
        organization_id=user.organization_id,
        crm_type=crm_type,
        is_enabled=False,
        connection_status='disconnected'
    )
    
    db.session.add(integration)
    db.session.commit()
    
    return jsonify({
        'message': 'Integration created',
        'integration': integration.to_dict()
    }), 201


@bp.route('/integrations/<int:integration_id>', methods=['GET'])
@jwt_required()
def get_integration(integration_id):
    """Get integration details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration or integration.organization_id != user.organization_id:
        return jsonify({'error': 'Integration not found'}), 404
    
    return jsonify({'integration': integration.to_dict()}), 200


@bp.route('/integrations/<int:integration_id>', methods=['PUT'])
@jwt_required()
def update_integration(integration_id):
    """Update integration settings."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration or integration.organization_id != user.organization_id:
        return jsonify({'error': 'Integration not found'}), 404
    
    data = request.get_json()
    
    # Update settings
    for field in ['sync_enabled', 'sync_direction', 'sync_frequency_minutes',
                  'opportunity_field_mapping', 'contact_field_mapping',
                  'create_opportunities', 'create_contacts', 'update_on_win_loss']:
        if field in data:
            setattr(integration, field, data[field])
    
    db.session.commit()
    
    return jsonify({
        'message': 'Integration updated',
        'integration': integration.to_dict()
    }), 200


@bp.route('/integrations/<int:integration_id>', methods=['DELETE'])
@jwt_required()
def delete_integration(integration_id):
    """Delete a CRM integration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration or integration.organization_id != user.organization_id:
        return jsonify({'error': 'Integration not found'}), 404
    
    db.session.delete(integration)
    db.session.commit()
    
    return jsonify({'message': 'Integration deleted'}), 200


# =============================================================================
# OAUTH CONNECTION
# =============================================================================

@bp.route('/integrations/<crm_type>/connect', methods=['POST'])
@jwt_required()
def connect_by_type(crm_type):
    """Create integration and initiate OAuth connection by CRM type."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    if crm_type not in ['salesforce', 'hubspot', 'pipedrive', 'zoho']:
        return jsonify({'error': 'Invalid CRM type'}), 400
    
    # Check if integration already exists, create if not
    integration = CRMIntegration.query.filter_by(
        organization_id=user.organization_id,
        crm_type=crm_type
    ).first()
    
    if not integration:
        integration = CRMIntegration(
            organization_id=user.organization_id,
            crm_type=crm_type,
            is_enabled=False,
            connection_status='disconnected'
        )
        db.session.add(integration)
        db.session.commit()
    
    # Generate state for CSRF protection
    state = f'{integration.id}:{secrets.token_urlsafe(32)}'
    
    base_url = current_app.config.get('BASE_URL', 'http://localhost:5000')
    redirect_uri = f'{base_url}/api/crm/callback'
    
    if crm_type == 'salesforce':
        client_id = current_app.config.get('SALESFORCE_CLIENT_ID', 'demo_client_id')
        
        if client_id == 'demo_client_id':
            # Demo mode - simulate successful connection
            integration.connection_status = 'connected'
            integration.is_enabled = True
            integration.connected_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'message': 'Salesforce connected (demo mode)',
                'integration': integration.to_dict(),
                'demo_mode': True
            }), 200
        
        sf_auth_url = 'https://login.salesforce.com/services/oauth2/authorize'
        params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'state': state,
            'scope': 'api refresh_token'
        }
        auth_url = f'{sf_auth_url}?{urllib.parse.urlencode(params)}'
        
    elif crm_type == 'hubspot':
        client_id = current_app.config.get('HUBSPOT_CLIENT_ID', 'demo_client_id')
        
        if client_id == 'demo_client_id':
            # Demo mode - simulate successful connection
            integration.connection_status = 'connected'
            integration.is_enabled = True
            integration.connected_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'message': 'HubSpot connected (demo mode)',
                'integration': integration.to_dict(),
                'demo_mode': True
            }), 200
        
        hs_auth_url = 'https://app.hubspot.com/oauth/authorize'
        params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'state': state,
            'scope': 'crm.objects.deals.read crm.objects.deals.write'
        }
        auth_url = f'{hs_auth_url}?{urllib.parse.urlencode(params)}'
    
    else:
        # Demo mode for other CRM types
        integration.connection_status = 'connected'
        integration.is_enabled = True
        integration.connected_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': f'{crm_type} connected (demo mode)',
            'integration': integration.to_dict(),
            'demo_mode': True
        }), 200
    
    return jsonify({
        'authorization_url': auth_url,
        'integration_id': integration.id
    }), 200

@bp.route('/integrations/<int:integration_id>/connect', methods=['GET'])
@jwt_required()
def initiate_connection(integration_id):
    """Initiate OAuth connection to CRM."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration or integration.organization_id != user.organization_id:
        return jsonify({'error': 'Integration not found'}), 404
    
    # Generate state for CSRF protection
    state = f'{integration_id}:{secrets.token_urlsafe(32)}'
    
    base_url = current_app.config.get('BASE_URL', 'http://localhost:5000')
    redirect_uri = f'{base_url}/api/crm/callback'
    
    if integration.crm_type == 'salesforce':
        # Salesforce OAuth URL
        sf_auth_url = 'https://login.salesforce.com/services/oauth2/authorize'
        client_id = current_app.config.get('SALESFORCE_CLIENT_ID')
        
        params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'state': state,
            'scope': 'api refresh_token'
        }
        
        auth_url = f'{sf_auth_url}?{urllib.parse.urlencode(params)}'
        
    elif integration.crm_type == 'hubspot':
        # HubSpot OAuth URL
        hs_auth_url = 'https://app.hubspot.com/oauth/authorize'
        client_id = current_app.config.get('HUBSPOT_CLIENT_ID')
        
        params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'state': state,
            'scope': 'crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read crm.objects.contacts.write'
        }
        
        auth_url = f'{hs_auth_url}?{urllib.parse.urlencode(params)}'
    
    else:
        return jsonify({'error': 'CRM type not supported for OAuth'}), 400
    
    return jsonify({
        'auth_url': auth_url,
        'message': 'Redirect user to auth_url to complete connection'
    }), 200


@bp.route('/callback', methods=['GET'])
def oauth_callback():
    """Handle OAuth callback from CRM."""
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    
    if error:
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        return redirect(f'{frontend_url}/settings/integrations?error={error}')
    
    if not code or not state:
        return jsonify({'error': 'Missing code or state'}), 400
    
    # Parse state to get integration ID
    try:
        integration_id = int(state.split(':')[0])
    except:
        return jsonify({'error': 'Invalid state'}), 400
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration:
        return jsonify({'error': 'Integration not found'}), 404
    
    import requests
    base_url = current_app.config.get('BASE_URL', 'http://localhost:5000')
    redirect_uri = f'{base_url}/api/crm/callback'
    
    try:
        if integration.crm_type == 'salesforce':
            # Exchange code for tokens
            token_url = 'https://login.salesforce.com/services/oauth2/token'
            response = requests.post(token_url, data={
                'grant_type': 'authorization_code',
                'code': code,
                'client_id': current_app.config.get('SALESFORCE_CLIENT_ID'),
                'client_secret': current_app.config.get('SALESFORCE_CLIENT_SECRET'),
                'redirect_uri': redirect_uri
            })
            
            if response.status_code != 200:
                raise ValueError(f'Token exchange failed: {response.text}')
            
            tokens = response.json()
            integration.access_token = tokens['access_token']
            integration.refresh_token = tokens.get('refresh_token')
            integration.instance_url = tokens['instance_url']
            
        elif integration.crm_type == 'hubspot':
            # Exchange code for tokens
            token_url = 'https://api.hubapi.com/oauth/v1/token'
            response = requests.post(token_url, data={
                'grant_type': 'authorization_code',
                'code': code,
                'client_id': current_app.config.get('HUBSPOT_CLIENT_ID'),
                'client_secret': current_app.config.get('HUBSPOT_CLIENT_SECRET'),
                'redirect_uri': redirect_uri
            })
            
            if response.status_code != 200:
                raise ValueError(f'Token exchange failed: {response.text}')
            
            tokens = response.json()
            integration.access_token = tokens['access_token']
            integration.refresh_token = tokens['refresh_token']
            integration.instance_url = 'https://api.hubapi.com'
        
        integration.connection_status = 'connected'
        integration.connected_at = datetime.utcnow()
        integration.is_enabled = True
        
        db.session.commit()
        
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        return redirect(f'{frontend_url}/settings/integrations?connected={integration.crm_type}')
        
    except Exception as e:
        integration.connection_status = 'error'
        integration.last_sync_error = str(e)
        db.session.commit()
        
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        return redirect(f'{frontend_url}/settings/integrations?error={urllib.parse.quote(str(e))}')


@bp.route('/integrations/<int:integration_id>/disconnect', methods=['POST'])
@jwt_required()
def disconnect_integration(integration_id):
    """Disconnect CRM integration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration or integration.organization_id != user.organization_id:
        return jsonify({'error': 'Integration not found'}), 404
    
    integration.access_token = None
    integration.refresh_token = None
    integration.connection_status = 'disconnected'
    integration.is_enabled = False
    
    db.session.commit()
    
    return jsonify({'message': 'Integration disconnected'}), 200


# =============================================================================
# SYNC OPERATIONS
# =============================================================================

@bp.route('/integrations/<int:integration_id>/sync', methods=['POST'])
@jwt_required()
def trigger_sync(integration_id):
    """Manually trigger a sync."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration or integration.organization_id != user.organization_id:
        return jsonify({'error': 'Integration not found'}), 404
    
    if integration.connection_status != 'connected':
        return jsonify({'error': 'Integration not connected'}), 400
    
    # Create sync log
    sync_log = CRMSyncLog(
        integration_id=integration_id,
        sync_type='manual',
        direction='push',
        triggered_by=user_id
    )
    db.session.add(sync_log)
    db.session.flush()
    
    try:
        # Perform sync based on CRM type
        if integration.crm_type == 'salesforce':
            results = _sync_to_salesforce(integration, sync_log)
        elif integration.crm_type == 'hubspot':
            results = _sync_to_hubspot(integration, sync_log)
        else:
            raise ValueError(f'Sync not implemented for {integration.crm_type}')
        
        sync_log.status = 'success'
        sync_log.completed_at = datetime.utcnow()
        
        integration.last_sync_at = datetime.utcnow()
        integration.last_sync_status = 'success'
        integration.total_syncs = (integration.total_syncs or 0) + 1
        
    except Exception as e:
        sync_log.status = 'failed'
        sync_log.error_message = str(e)
        sync_log.completed_at = datetime.utcnow()
        
        integration.last_sync_status = 'failed'
        integration.last_sync_error = str(e)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Sync completed',
        'sync_log': sync_log.to_dict()
    }), 200


@bp.route('/integrations/<int:integration_id>/sync-logs', methods=['GET'])
@jwt_required()
def get_sync_logs(integration_id):
    """Get sync history for an integration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    integration = CRMIntegration.query.get(integration_id)
    if not integration or integration.organization_id != user.organization_id:
        return jsonify({'error': 'Integration not found'}), 404
    
    limit = request.args.get('limit', 20, type=int)
    
    logs = CRMSyncLog.query.filter_by(
        integration_id=integration_id
    ).order_by(CRMSyncLog.started_at.desc()).limit(limit).all()
    
    return jsonify({
        'sync_logs': [l.to_dict() for l in logs]
    }), 200


# =============================================================================
# PROJECT <-> CRM MAPPING
# =============================================================================

@bp.route('/projects/<int:project_id>/crm-record', methods=['GET'])
@jwt_required()
def get_project_crm_record(project_id):
    """Get CRM record linked to a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    # Find sync records for this project
    records = CRMSyncRecord.query.filter_by(
        local_entity_type='project',
        local_entity_id=project_id
    ).all()
    
    return jsonify({
        'crm_records': [r.to_dict() for r in records]
    }), 200


@bp.route('/projects/<int:project_id>/push-to-crm', methods=['POST'])
@jwt_required()
def push_project_to_crm(project_id):
    """Push a project to CRM as an opportunity."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.get_json() or {}
    integration_id = data.get('integration_id')
    
    # Find active integration
    if integration_id:
        integration = CRMIntegration.query.get(integration_id)
    else:
        integration = CRMIntegration.query.filter_by(
            organization_id=user.organization_id,
            is_enabled=True,
            connection_status='connected'
        ).first()
    
    if not integration:
        return jsonify({'error': 'No active CRM integration found'}), 400
    
    try:
        if integration.crm_type == 'salesforce':
            record_id = _push_to_salesforce(integration, project)
        elif integration.crm_type == 'hubspot':
            record_id = _push_to_hubspot(integration, project)
        else:
            return jsonify({'error': f'Push not supported for {integration.crm_type}'}), 400
        
        # Create or update sync record
        sync_record = CRMSyncRecord.query.filter_by(
            integration_id=integration.id,
            local_entity_type='project',
            local_entity_id=project_id
        ).first()
        
        if not sync_record:
            sync_record = CRMSyncRecord(
                integration_id=integration.id,
                local_entity_type='project',
                local_entity_id=project_id,
                remote_entity_type='Opportunity',
                remote_entity_id=record_id
            )
            db.session.add(sync_record)
        else:
            sync_record.remote_entity_id = record_id
        
        sync_record.last_synced_at = datetime.utcnow()
        sync_record.sync_status = 'synced'
        
        integration.opportunities_created = (integration.opportunities_created or 0) + 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Project pushed to {integration.crm_type}',
            'crm_record_id': record_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _sync_to_salesforce(integration: CRMIntegration, sync_log: CRMSyncLog) -> dict:
    """Sync data to Salesforce."""
    import requests
    
    # Get all projects that need syncing
    projects = Project.query.filter_by(
        organization_id=integration.organization_id
    ).all()
    
    results = {
        'created': 0,
        'updated': 0,
        'failed': 0
    }
    
    for project in projects:
        try:
            # Check if already synced
            sync_record = CRMSyncRecord.query.filter_by(
                integration_id=integration.id,
                local_entity_type='project',
                local_entity_id=project.id
            ).first()
            
            # Map project to Salesforce Opportunity
            field_mapping = integration.opportunity_field_mapping or {}
            
            opportunity_data = {
                field_mapping.get('name', 'Name'): project.name,
                field_mapping.get('stage', 'StageName'): _map_stage_to_sf(project.status),
                field_mapping.get('close_date', 'CloseDate'): str(project.due_date) if project.due_date else None,
                field_mapping.get('description', 'Description'): project.description
            }
            
            headers = {
                'Authorization': f'Bearer {integration.access_token}',
                'Content-Type': 'application/json'
            }
            
            if sync_record:
                # Update existing
                url = f'{integration.instance_url}/services/data/v58.0/sobjects/Opportunity/{sync_record.remote_entity_id}'
                response = requests.patch(url, json=opportunity_data, headers=headers)
                if response.status_code == 204:
                    results['updated'] += 1
                    sync_record.last_synced_at = datetime.utcnow()
            else:
                # Create new
                url = f'{integration.instance_url}/services/data/v58.0/sobjects/Opportunity'
                response = requests.post(url, json=opportunity_data, headers=headers)
                if response.status_code == 201:
                    results['created'] += 1
                    record_id = response.json()['id']
                    
                    new_record = CRMSyncRecord(
                        integration_id=integration.id,
                        local_entity_type='project',
                        local_entity_id=project.id,
                        remote_entity_type='Opportunity',
                        remote_entity_id=record_id,
                        last_synced_at=datetime.utcnow()
                    )
                    db.session.add(new_record)
                    
        except Exception as e:
            results['failed'] += 1
    
    sync_log.records_processed = len(projects)
    sync_log.records_created = results['created']
    sync_log.records_updated = results['updated']
    sync_log.records_failed = results['failed']
    
    return results


def _sync_to_hubspot(integration: CRMIntegration, sync_log: CRMSyncLog) -> dict:
    """Sync data to HubSpot."""
    import requests
    
    projects = Project.query.filter_by(
        organization_id=integration.organization_id
    ).all()
    
    results = {'created': 0, 'updated': 0, 'failed': 0}
    
    headers = {
        'Authorization': f'Bearer {integration.access_token}',
        'Content-Type': 'application/json'
    }
    
    for project in projects:
        try:
            sync_record = CRMSyncRecord.query.filter_by(
                integration_id=integration.id,
                local_entity_type='project',
                local_entity_id=project.id
            ).first()
            
            deal_data = {
                'properties': {
                    'dealname': project.name,
                    'dealstage': _map_stage_to_hs(project.status),
                    'description': project.description,
                    'closedate': int(project.due_date.timestamp() * 1000) if project.due_date else None
                }
            }
            
            if sync_record:
                url = f'https://api.hubapi.com/crm/v3/objects/deals/{sync_record.remote_entity_id}'
                response = requests.patch(url, json=deal_data, headers=headers)
                if response.status_code == 200:
                    results['updated'] += 1
                    sync_record.last_synced_at = datetime.utcnow()
            else:
                url = 'https://api.hubapi.com/crm/v3/objects/deals'
                response = requests.post(url, json=deal_data, headers=headers)
                if response.status_code == 201:
                    results['created'] += 1
                    record_id = response.json()['id']
                    
                    new_record = CRMSyncRecord(
                        integration_id=integration.id,
                        local_entity_type='project',
                        local_entity_id=project.id,
                        remote_entity_type='Deal',
                        remote_entity_id=record_id,
                        last_synced_at=datetime.utcnow()
                    )
                    db.session.add(new_record)
                    
        except:
            results['failed'] += 1
    
    sync_log.records_processed = len(projects)
    sync_log.records_created = results['created']
    sync_log.records_updated = results['updated']
    sync_log.records_failed = results['failed']
    
    return results


def _push_to_salesforce(integration: CRMIntegration, project: Project) -> str:
    """Push single project to Salesforce."""
    import requests
    
    field_mapping = integration.opportunity_field_mapping or {}
    
    opportunity_data = {
        field_mapping.get('name', 'Name'): project.name,
        field_mapping.get('stage', 'StageName'): _map_stage_to_sf(project.status),
        field_mapping.get('close_date', 'CloseDate'): str(project.due_date) if project.due_date else str(datetime.now().date()),
        field_mapping.get('description', 'Description'): project.description or ''
    }
    
    headers = {
        'Authorization': f'Bearer {integration.access_token}',
        'Content-Type': 'application/json'
    }
    
    url = f'{integration.instance_url}/services/data/v58.0/sobjects/Opportunity'
    response = requests.post(url, json=opportunity_data, headers=headers)
    
    if response.status_code == 201:
        return response.json()['id']
    else:
        raise ValueError(f'Salesforce API error: {response.text}')


def _push_to_hubspot(integration: CRMIntegration, project: Project) -> str:
    """Push single project to HubSpot."""
    import requests
    
    deal_data = {
        'properties': {
            'dealname': project.name,
            'dealstage': _map_stage_to_hs(project.status),
            'description': project.description or ''
        }
    }
    
    if project.due_date:
        deal_data['properties']['closedate'] = int(project.due_date.timestamp() * 1000)
    
    headers = {
        'Authorization': f'Bearer {integration.access_token}',
        'Content-Type': 'application/json'
    }
    
    url = 'https://api.hubapi.com/crm/v3/objects/deals'
    response = requests.post(url, json=deal_data, headers=headers)
    
    if response.status_code == 201:
        return response.json()['id']
    else:
        raise ValueError(f'HubSpot API error: {response.text}')


def _map_stage_to_sf(status: str) -> str:
    """Map project status to Salesforce stage."""
    mapping = {
        'draft': 'Qualification',
        'in_progress': 'Proposal/Price Quote',
        'review': 'Negotiation/Review',
        'submitted': 'Closed Won',
        'completed': 'Closed Won',
        'archived': 'Closed Lost'
    }
    return mapping.get(status, 'Qualification')


def _map_stage_to_hs(status: str) -> str:
    """Map project status to HubSpot stage."""
    mapping = {
        'draft': 'qualifiedtobuy',
        'in_progress': 'presentationscheduled',
        'review': 'decisionmakerboughtin',
        'submitted': 'closedwon',
        'completed': 'closedwon',
        'archived': 'closedlost'
    }
    return mapping.get(status, 'qualifiedtobuy')
