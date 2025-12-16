from datetime import datetime
from ..extensions import db


class KnowledgeItem(db.Model):
    """Knowledge base item for semantic search and answer generation."""
    __tablename__ = 'knowledge_items'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    tags = db.Column(db.JSON, default=list)  # Array of tags for filtering
    category = db.Column(db.String(100), nullable=True)  # security, compliance, product, legal
    compliance_frameworks = db.Column(db.JSON, default=list)  # SOC2, ISO27001, GDPR, etc.
    chunk_index = db.Column(db.Integer, nullable=True)  # For chunked documents
    parent_id = db.Column(db.Integer, db.ForeignKey('knowledge_items.id'), nullable=True)  # Parent item for chunks
    usage_count = db.Column(db.Integer, default=0)  # Track how often used in answers
    last_used_at = db.Column(db.DateTime, nullable=True)  # Last time used for answer generation
    source_type = db.Column(db.String(50), default='manual')  # document, csv, manual, file, approved_answer
    source_file = db.Column(db.String(255), nullable=True)  # Original file if imported
    file_path = db.Column(db.String(512), nullable=True)  # Path to uploaded file (optional)
    file_type = db.Column(db.String(100), nullable=True)  # MIME type
    file_data = db.Column(db.LargeBinary, nullable=True)  # Binary file content
    file_size = db.Column(db.Integer, nullable=True)  # File size in bytes
    embedding_id = db.Column(db.String(255), nullable=True)  # Qdrant point ID
    item_metadata = db.Column(db.JSON, default=dict)  # Additional metadata
    is_active = db.Column(db.Boolean, default=True)
    folder_id = db.Column(db.Integer, db.ForeignKey('knowledge_folders.id'), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', back_populates='knowledge_items')
    creator = db.relationship('User', foreign_keys=[created_by])
    folder = db.relationship('KnowledgeFolder', back_populates='items')
    parent = db.relationship('KnowledgeItem', remote_side=[id], backref='chunks')
    
    def to_dict(self):
        """Serialize knowledge item to dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'tags': self.tags,
            'category': self.category,
            'compliance_frameworks': self.compliance_frameworks or [],
            'chunk_index': self.chunk_index,
            'parent_id': self.parent_id,
            'usage_count': self.usage_count,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'source_type': self.source_type,
            'source_file': self.source_file,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'folder_id': self.folder_id,
            'is_active': self.is_active,
            'organization_id': self.organization_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

