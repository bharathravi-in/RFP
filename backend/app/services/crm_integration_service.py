"""
CRM Integration Service

Handles integrations with external CRM platforms:
- Salesforce
- HubSpot
- Generic webhook receivers

Provides:
- Inbound webhook receivers for opportunity updates
- Project creation from CRM deals
- Outcome sync back to CRM
"""
import logging
import hmac
import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class CRMIntegrationService:
    """
    Service for integrating with external CRM platforms.
    
    Supports:
    - Salesforce Opportunity webhooks
    - HubSpot Deal webhooks
    - Custom webhook receivers
    """
    
    def __init__(self, organization_id: int = None):
        self.organization_id = organization_id
    
    # ================================
    # Salesforce Integration
    # ================================
    
    def verify_salesforce_signature(self, payload: bytes, signature: str, secret: str) -> bool:
        """Verify Salesforce webhook signature."""
        try:
            expected = hmac.new(
                secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        except Exception as e:
            logger.error(f"Salesforce signature verification failed: {e}")
            return False
    
    def process_salesforce_opportunity(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process Salesforce Opportunity webhook.
        
        Salesforce sends webhooks when opportunities are created/updated.
        Maps Salesforce fields to RFP project fields.
        """
        try:
            # Extract Salesforce fields
            sf_opp = data.get('sObject', data)
            
            opportunity_id = sf_opp.get('Id')
            name = sf_opp.get('Name', 'Untitled Opportunity')
            stage = sf_opp.get('StageName', 'Prospecting')
            amount = sf_opp.get('Amount', 0)
            close_date = sf_opp.get('CloseDate')
            account_name = sf_opp.get('Account', {}).get('Name', '')
            description = sf_opp.get('Description', '')
            
            # Map Salesforce stage to RFP status
            stage_mapping = {
                'Prospecting': 'draft',
                'Qualification': 'in_progress',
                'Needs Analysis': 'in_progress',
                'Value Proposition': 'in_progress',
                'Proposal/Price Quote': 'review',
                'Negotiation/Review': 'review',
                'Closed Won': 'completed',
                'Closed Lost': 'completed',
            }
            
            # Map to outcome for closed deals
            outcome_mapping = {
                'Closed Won': 'won',
                'Closed Lost': 'lost',
            }
            
            return {
                'success': True,
                'project_data': {
                    'name': name,
                    'client_name': account_name,
                    'description': description,
                    'status': stage_mapping.get(stage, 'draft'),
                    'outcome': outcome_mapping.get(stage),
                    'contract_value': amount,
                    'due_date': close_date,
                    'external_id': f"sf_{opportunity_id}",
                    'external_source': 'salesforce',
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to process Salesforce opportunity: {e}")
            return {'success': False, 'error': str(e)}
    
    # ================================
    # HubSpot Integration
    # ================================
    
    def verify_hubspot_signature(self, payload: bytes, signature: str, secret: str) -> bool:
        """Verify HubSpot webhook signature (v3)."""
        try:
            # HubSpot v3 uses SHA-256
            expected = hmac.new(
                secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(f"sha256={expected}", signature)
        except Exception as e:
            logger.error(f"HubSpot signature verification failed: {e}")
            return False
    
    def process_hubspot_deal(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process HubSpot Deal webhook.
        
        HubSpot sends webhooks via workflow actions or native webhooks.
        Maps HubSpot deal properties to RFP project fields.
        """
        try:
            # Extract HubSpot deal properties
            deal = data.get('properties', data)
            
            deal_id = data.get('id') or deal.get('hs_object_id')
            name = deal.get('dealname', 'Untitled Deal')
            stage = deal.get('dealstage', '')
            amount = float(deal.get('amount', 0) or 0)
            close_date = deal.get('closedate')
            company = deal.get('company_name', '')
            description = deal.get('description', '')
            
            # Map HubSpot stage to RFP status
            # Note: HubSpot stages are customizable, these are defaults
            stage_mapping = {
                'appointmentscheduled': 'draft',
                'qualifiedtobuy': 'in_progress',
                'presentationscheduled': 'in_progress',
                'decisionmakerboughtin': 'review',
                'contractsent': 'review',
                'closedwon': 'completed',
                'closedlost': 'completed',
            }
            
            outcome_mapping = {
                'closedwon': 'won',
                'closedlost': 'lost',
            }
            
            return {
                'success': True,
                'project_data': {
                    'name': name,
                    'client_name': company,
                    'description': description,
                    'status': stage_mapping.get(stage.lower(), 'draft'),
                    'outcome': outcome_mapping.get(stage.lower()),
                    'contract_value': amount,
                    'due_date': close_date,
                    'external_id': f"hs_{deal_id}",
                    'external_source': 'hubspot',
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to process HubSpot deal: {e}")
            return {'success': False, 'error': str(e)}
    
    # ================================
    # Project Sync
    # ================================
    
    def create_or_update_project(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create or update a project from CRM data.
        
        Uses external_id to find existing projects.
        """
        try:
            from app.models import Project, Organization
            from app.extensions import db
            
            external_id = project_data.get('external_id')
            
            # Find existing project by external ID
            project = None
            if external_id:
                project = Project.query.filter_by(
                    organization_id=self.organization_id,
                    external_id=external_id
                ).first()
            
            if project:
                # Update existing project
                project.name = project_data.get('name', project.name)
                project.client_name = project_data.get('client_name', project.client_name)
                project.description = project_data.get('description', project.description)
                project.status = project_data.get('status', project.status)
                
                # Update outcome if provided
                if project_data.get('outcome'):
                    project.outcome = project_data['outcome']
                    project.outcome_date = datetime.utcnow()
                
                if project_data.get('contract_value'):
                    project.contract_value = project_data['contract_value']
                
                project.updated_at = datetime.utcnow()
                
                db.session.commit()
                
                return {
                    'success': True,
                    'action': 'updated',
                    'project_id': project.id,
                    'project_name': project.name
                }
            else:
                # Create new project
                project = Project(
                    organization_id=self.organization_id,
                    name=project_data.get('name', 'CRM Import'),
                    client_name=project_data.get('client_name', ''),
                    description=project_data.get('description', ''),
                    status=project_data.get('status', 'draft'),
                    external_id=external_id,
                    external_source=project_data.get('external_source'),
                )
                
                if project_data.get('contract_value'):
                    project.contract_value = project_data['contract_value']
                
                db.session.add(project)
                db.session.commit()
                
                return {
                    'success': True,
                    'action': 'created',
                    'project_id': project.id,
                    'project_name': project.name
                }
                
        except Exception as e:
            logger.error(f"Failed to create/update project from CRM: {e}")
            return {'success': False, 'error': str(e)}
    
    # ================================
    # Outbound Sync (RFP → CRM)
    # ================================
    
    def sync_outcome_to_crm(self, project_id: int, outcome: str) -> Dict[str, Any]:
        """
        Sync project outcome back to CRM.
        
        Called when a project outcome is set in RFP Pro.
        Dispatches webhooks to update the CRM.
        """
        try:
            from app.models import Project
            from app.services.webhook_dispatcher import webhook_dispatcher
            
            project = Project.query.get(project_id)
            if not project:
                return {'success': False, 'error': 'Project not found'}
            
            # Dispatch outcome webhook
            webhook_dispatcher.dispatch(
                event_type='project.outcome_set',
                payload={
                    'project_id': project.id,
                    'project_name': project.name,
                    'external_id': project.external_id,
                    'external_source': project.external_source,
                    'outcome': outcome,
                    'outcome_date': datetime.utcnow().isoformat(),
                    'contract_value': project.contract_value,
                },
                organization_id=project.organization_id
            )
            
            return {'success': True, 'message': 'Outcome synced'}
            
        except Exception as e:
            logger.error(f"Failed to sync outcome to CRM: {e}")
            return {'success': False, 'error': str(e)}


def get_crm_integration_service(organization_id: int = None) -> CRMIntegrationService:
    """Factory function to get CRM Integration Service."""
    return CRMIntegrationService(organization_id=organization_id)
