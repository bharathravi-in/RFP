"""Activity Log model for tracking user actions in projects."""
from datetime import datetime
from ..extensions import db


class ActivityLog(db.Model):
    """
    Tracks user activities within projects for audit trail and timeline display.
    """
    __tablename__ = 'activity_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Activity details
    action = db.Column(db.String(50), nullable=False)  # created, updated, approved, commented, exported, etc.
    entity_type = db.Column(db.String(50), nullable=False)  # project, section, document, answer, etc.
    entity_id = db.Column(db.Integer, nullable=True)
    entity_name = db.Column(db.String(255), nullable=True)  # Human readable name
    
    # Additional context
    description = db.Column(db.Text, nullable=True)  # Optional description
    extra_data = db.Column(db.JSON, default=dict)  # Extra data like old/new values
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref='activity_logs')
    project = db.relationship('Project', backref='activity_logs')
    user = db.relationship('User', backref='activity_logs')
    
    def to_dict(self):
        """Serialize to dictionary."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else 'Unknown',
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'description': self.description,
            'extra_data': self.extra_data or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    @classmethod
    def log(cls, organization_id, user_id, action, entity_type, entity_id=None, 
            entity_name=None, project_id=None, description=None, extra_data=None):
        """Helper to create a log entry."""
        log_entry = cls(
            organization_id=organization_id,
            project_id=project_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            description=description,
            extra_data=extra_data or {}
        )
        db.session.add(log_entry)
        return log_entry

