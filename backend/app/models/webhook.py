"""
Webhook Configuration Model for external integrations.

Allows organizations to receive event notifications at their endpoints.
"""
from datetime import datetime
from ..extensions import db


class WebhookConfig(db.Model):
    """Webhook configuration for organization event notifications."""
    
    __tablename__ = 'webhook_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    # Webhook details
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    secret = db.Column(db.String(255))  # For HMAC signature verification
    
    # Events to trigger on
    events = db.Column(db.JSON, default=list)  # ['proposal.created', 'section.approved', etc.]
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Statistics
    last_triggered_at = db.Column(db.DateTime, nullable=True)
    success_count = db.Column(db.Integer, default=0)
    failure_count = db.Column(db.Integer, default=0)
    
    # Relationship
    organization = db.relationship('Organization', backref=db.backref('webhooks', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'name': self.name,
            'url': self.url,
            'events': self.events or [],
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_triggered_at': self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            'success_count': self.success_count,
            'failure_count': self.failure_count,
        }


class WebhookDelivery(db.Model):
    """Log of webhook delivery attempts."""
    
    __tablename__ = 'webhook_deliveries'
    
    id = db.Column(db.Integer, primary_key=True)
    webhook_id = db.Column(db.Integer, db.ForeignKey('webhook_configs.id', ondelete='CASCADE'), nullable=False)
    
    # Event details
    event_type = db.Column(db.String(50), nullable=False)
    payload = db.Column(db.JSON)
    
    # Delivery result
    status_code = db.Column(db.Integer)
    response_body = db.Column(db.Text)
    error_message = db.Column(db.Text)
    
    # Timing
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    delivered_at = db.Column(db.DateTime)
    duration_ms = db.Column(db.Integer)
    
    # Status
    success = db.Column(db.Boolean, default=False)
    
    # Relationship
    webhook = db.relationship('WebhookConfig', backref=db.backref('deliveries', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'webhook_id': self.webhook_id,
            'event_type': self.event_type,
            'payload': self.payload,
            'status_code': self.status_code,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'duration_ms': self.duration_ms,
            'success': self.success,
        }


# Event types for webhooks
WEBHOOK_EVENTS = {
    'project.created': 'When a new project is created',
    'project.updated': 'When a project is modified',
    'project.deleted': 'When a project is deleted',
    'section.created': 'When a section is added',
    'section.generated': 'When AI generates content for a section',
    'section.approved': 'When a section is approved',
    'section.rejected': 'When a section is rejected',
    'document.uploaded': 'When a document is uploaded',
    'document.processed': 'When document processing completes',
    'export.completed': 'When a proposal export is completed',
    'comment.created': 'When a comment is added',
    'answer.generated': 'When an AI answer is generated',
}
