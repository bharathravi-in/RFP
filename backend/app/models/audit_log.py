"""
Audit Log Model

Tracks all user actions for compliance and governance.
Provides complete audit trail for RFP response activities.
"""
from datetime import datetime
from ..extensions import db


class AuditLog(db.Model):
    """Audit log for tracking all user actions."""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(100), nullable=False)  # create, update, delete, approve, reject, export, generate, etc.
    resource_type = db.Column(db.String(50), nullable=False)  # answer, question, document, knowledge, project
    resource_id = db.Column(db.Integer, nullable=True)
    old_value = db.Column(db.JSON, nullable=True)  # Previous state (for updates)
    new_value = db.Column(db.JSON, nullable=True)  # New state
    details = db.Column(db.JSON, default=dict)  # Additional context/metadata
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    ip_address = db.Column(db.String(50), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User')
    organization = db.relationship('Organization')
    
    def to_dict(self):
        """Serialize audit log to dictionary."""
        return {
            'id': self.id,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'details': self.details,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'organization_id': self.organization_id,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def log(
        cls,
        action: str,
        resource_type: str,
        user_id: int,
        organization_id: int,
        resource_id: int = None,
        old_value: dict = None,
        new_value: dict = None,
        details: dict = None,
        ip_address: str = None,
        user_agent: str = None
    ):
        """
        Create an audit log entry.
        
        Args:
            action: The action performed (create, update, delete, approve, etc.)
            resource_type: Type of resource (answer, question, document, etc.)
            user_id: ID of the user performing the action
            organization_id: ID of the organization
            resource_id: ID of the resource being acted upon
            old_value: Previous state (for updates)
            new_value: New state
            details: Any additional context
            ip_address: Client IP address
            user_agent: Client user agent string
        
        Returns:
            The created AuditLog instance
        """
        log = cls(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            details=details or {},
            user_id=user_id,
            organization_id=organization_id,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(log)
        return log


class ComplianceMapping(db.Model):
    """Map knowledge items to compliance frameworks and controls."""
    __tablename__ = 'compliance_mappings'
    
    id = db.Column(db.Integer, primary_key=True)
    framework = db.Column(db.String(50), nullable=False)  # SOC2, ISO27001, GDPR, HIPAA, PCI-DSS, etc.
    control_id = db.Column(db.String(50), nullable=False)  # CC6.1, A.12.1, Art.32, etc.
    control_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    knowledge_item_id = db.Column(db.Integer, db.ForeignKey('knowledge_items.id'), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    knowledge_item = db.relationship('KnowledgeItem')
    organization = db.relationship('Organization')
    
    def to_dict(self):
        """Serialize compliance mapping to dictionary."""
        return {
            'id': self.id,
            'framework': self.framework,
            'control_id': self.control_id,
            'control_name': self.control_name,
            'description': self.description,
            'knowledge_item_id': self.knowledge_item_id,
            'organization_id': self.organization_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ExportHistory(db.Model):
    """Track export history for audit purposes."""
    __tablename__ = 'export_history'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    format = db.Column(db.String(20), nullable=False)  # pdf, docx, xlsx
    filename = db.Column(db.String(255), nullable=False)
    question_count = db.Column(db.Integer, default=0)
    approved_count = db.Column(db.Integer, default=0)
    file_size = db.Column(db.Integer, nullable=True)  # bytes
    export_options = db.Column(db.JSON, default=dict)  # Any export configuration
    exported_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project')
    user = db.relationship('User')
    
    def to_dict(self):
        """Serialize export history to dictionary."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else None,
            'format': self.format,
            'filename': self.filename,
            'question_count': self.question_count,
            'approved_count': self.approved_count,
            'file_size': self.file_size,
            'export_options': self.export_options,
            'exported_by': self.exported_by,
            'user_name': self.user.name if self.user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
