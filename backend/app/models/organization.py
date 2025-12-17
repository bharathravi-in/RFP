from datetime import datetime
from ..extensions import db


class Organization(db.Model):
    """Organization model for multi-tenancy."""
    __tablename__ = 'organizations'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), unique=True, nullable=False, index=True)
    settings = db.Column(db.JSON, default=dict)  # AI preferences, integrations config
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    users = db.relationship('User', back_populates='organization')
    projects = db.relationship('Project', back_populates='organization')
    knowledge_items = db.relationship('KnowledgeItem', back_populates='organization')
    ai_configs = db.relationship('OrganizationAIConfig', back_populates='organization', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Serialize organization to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'settings': self.settings,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_count': len(self.users) if self.users else 0,
            'project_count': len(self.projects) if self.projects else 0
        }
