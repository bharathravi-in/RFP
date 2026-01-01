"""
CRM Integration Models for Salesforce and HubSpot.

Syncs proposal data with external CRM systems.
"""
from datetime import datetime
from ..extensions import db


class CRMIntegration(db.Model):
    """CRM integration configuration for an organization."""
    
    __tablename__ = 'crm_integrations'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), 
                               nullable=False)
    
    # CRM Type
    crm_type = db.Column(db.String(50), nullable=False)  # salesforce, hubspot, pipedrive, zoho
    
    # Status
    is_enabled = db.Column(db.Boolean, default=False)
    connection_status = db.Column(db.String(50), default='disconnected')  # connected, disconnected, error
    
    # OAuth Credentials
    access_token = db.Column(db.Text)  # Encrypted
    refresh_token = db.Column(db.Text)  # Encrypted
    token_expires_at = db.Column(db.DateTime)
    
    # Instance info
    instance_url = db.Column(db.String(500))  # e.g., https://na1.salesforce.com
    api_version = db.Column(db.String(20))
    
    # Sync settings
    sync_enabled = db.Column(db.Boolean, default=True)
    sync_direction = db.Column(db.String(20), default='bidirectional')  # to_crm, from_crm, bidirectional
    sync_frequency_minutes = db.Column(db.Integer, default=15)
    last_sync_at = db.Column(db.DateTime)
    last_sync_status = db.Column(db.String(50))
    last_sync_error = db.Column(db.Text)
    
    # Field mappings
    opportunity_field_mapping = db.Column(db.JSON, default=lambda: {
        'name': 'Name',
        'value': 'Amount',
        'stage': 'StageName',
        'close_date': 'CloseDate',
        'probability': 'Probability',
        'description': 'Description'
    })
    
    contact_field_mapping = db.Column(db.JSON, default=lambda: {
        'email': 'Email',
        'first_name': 'FirstName',
        'last_name': 'LastName',
        'company': 'Company'
    })
    
    # Object type mappings
    create_opportunities = db.Column(db.Boolean, default=True)
    create_contacts = db.Column(db.Boolean, default=True)
    update_on_win_loss = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    connected_at = db.Column(db.DateTime)
    connected_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Statistics
    total_syncs = db.Column(db.Integer, default=0)
    opportunities_created = db.Column(db.Integer, default=0)
    opportunities_updated = db.Column(db.Integer, default=0)
    
    # Relationships
    organization = db.relationship('Organization', backref=db.backref('crm_integrations', lazy='dynamic'))
    connected_by_user = db.relationship('User', foreign_keys=[connected_by])
    
    def to_dict(self, include_tokens=False):
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'crm_type': self.crm_type,
            'is_enabled': self.is_enabled,
            'connection_status': self.connection_status,
            'instance_url': self.instance_url,
            'api_version': self.api_version,
            'sync_enabled': self.sync_enabled,
            'sync_direction': self.sync_direction,
            'sync_frequency_minutes': self.sync_frequency_minutes,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'last_sync_status': self.last_sync_status,
            'last_sync_error': self.last_sync_error,
            'opportunity_field_mapping': self.opportunity_field_mapping or {},
            'contact_field_mapping': self.contact_field_mapping or {},
            'create_opportunities': self.create_opportunities,
            'create_contacts': self.create_contacts,
            'update_on_win_loss': self.update_on_win_loss,
            'connected_at': self.connected_at.isoformat() if self.connected_at else None,
            'total_syncs': self.total_syncs,
            'opportunities_created': self.opportunities_created,
            'opportunities_updated': self.opportunities_updated,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_tokens:
            data['access_token'] = self.access_token
            data['refresh_token'] = self.refresh_token
        return data


class CRMSyncRecord(db.Model):
    """Record of synced entities between RFP Pro and CRM."""
    
    __tablename__ = 'crm_sync_records'
    
    id = db.Column(db.Integer, primary_key=True)
    integration_id = db.Column(db.Integer, db.ForeignKey('crm_integrations.id', ondelete='CASCADE'), nullable=False)
    
    # Local entity
    local_entity_type = db.Column(db.String(50), nullable=False)  # project, contact, organization
    local_entity_id = db.Column(db.Integer, nullable=False)
    
    # Remote entity
    remote_entity_type = db.Column(db.String(50), nullable=False)  # Opportunity, Contact, Account
    remote_entity_id = db.Column(db.String(100), nullable=False)  # CRM record ID
    
    # Sync state
    last_synced_at = db.Column(db.DateTime)
    local_modified_at = db.Column(db.DateTime)
    remote_modified_at = db.Column(db.DateTime)
    sync_status = db.Column(db.String(50), default='synced')  # synced, pending, conflict, error
    
    # Error tracking
    last_error = db.Column(db.Text)
    error_count = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    integration = db.relationship('CRMIntegration', backref=db.backref('sync_records', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'integration_id': self.integration_id,
            'local_entity_type': self.local_entity_type,
            'local_entity_id': self.local_entity_id,
            'remote_entity_type': self.remote_entity_type,
            'remote_entity_id': self.remote_entity_id,
            'last_synced_at': self.last_synced_at.isoformat() if self.last_synced_at else None,
            'sync_status': self.sync_status,
            'last_error': self.last_error,
            'error_count': self.error_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class CRMSyncLog(db.Model):
    """Log of CRM sync operations."""
    
    __tablename__ = 'crm_sync_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    integration_id = db.Column(db.Integer, db.ForeignKey('crm_integrations.id', ondelete='CASCADE'), nullable=False)
    
    # Sync details
    sync_type = db.Column(db.String(50), nullable=False)  # full, incremental, manual
    direction = db.Column(db.String(20), nullable=False)  # push, pull
    
    # Results
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    status = db.Column(db.String(50), default='running')  # running, success, partial, failed
    
    # Metrics
    records_processed = db.Column(db.Integer, default=0)
    records_created = db.Column(db.Integer, default=0)
    records_updated = db.Column(db.Integer, default=0)
    records_failed = db.Column(db.Integer, default=0)
    
    # Errors
    error_message = db.Column(db.Text)
    error_details = db.Column(db.JSON)
    
    # Triggered by
    triggered_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # None for automatic
    
    # Relationships
    integration = db.relationship('CRMIntegration')
    triggered_by_user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'integration_id': self.integration_id,
            'sync_type': self.sync_type,
            'direction': self.direction,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'records_processed': self.records_processed,
            'records_created': self.records_created,
            'records_updated': self.records_updated,
            'records_failed': self.records_failed,
            'error_message': self.error_message,
            'duration_seconds': (self.completed_at - self.started_at).total_seconds() if self.completed_at and self.started_at else None,
        }
