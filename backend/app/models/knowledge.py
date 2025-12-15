from datetime import datetime
from ..extensions import db


class KnowledgeItem(db.Model):
    """Knowledge base item for semantic search and answer generation."""
    __tablename__ = 'knowledge_items'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    tags = db.Column(db.JSON, default=list)  # Array of tags for filtering
    source_type = db.Column(db.String(50), default='manual')  # document, csv, manual
    source_file = db.Column(db.String(255), nullable=True)  # Original file if imported
    embedding_id = db.Column(db.String(255), nullable=True)  # Qdrant point ID
    item_metadata = db.Column(db.JSON, default=dict)  # Additional metadata
    is_active = db.Column(db.Boolean, default=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', back_populates='knowledge_items')
    creator = db.relationship('User', foreign_keys=[created_by])
    
    def to_dict(self):
        """Serialize knowledge item to dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'tags': self.tags,
            'source_type': self.source_type,
            'source_file': self.source_file,
            'is_active': self.is_active,
            'organization_id': self.organization_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
