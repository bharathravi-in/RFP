from datetime import datetime
from ..extensions import db


class Document(db.Model):
    """Document model for uploaded RFP/RFI files."""
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # File identification
    file_id = db.Column(db.String(100), unique=True, nullable=True, index=True)  # UUID for storage
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    
    # Storage info
    file_path = db.Column(db.String(500), nullable=True)  # Optional - for filesystem storage
    file_url = db.Column(db.String(1000), nullable=True)  # Cloud storage URL (gs://, file://, etc.)
    storage_type = db.Column(db.String(20), default='local')  # local, gcp
    file_data = db.Column(db.LargeBinary, nullable=True)  # Store file content in DB (legacy)
    
    # File properties
    file_type = db.Column(db.String(50), nullable=False)  # pdf, docx, xlsx
    file_size = db.Column(db.Integer, nullable=True)  # bytes
    content_type = db.Column(db.String(100), nullable=True)  # MIME type
    content_hash = db.Column(db.String(64), nullable=True)  # SHA256 hash for deduplication
    
    # Processing status
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    embedding_status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    
    # Content extraction
    extracted_text = db.Column(db.Text, nullable=True)
    
    # Chunk tracking
    chunk_count = db.Column(db.Integer, default=0)  # Number of chunks in Qdrant
    page_count = db.Column(db.Integer, nullable=True)  # Number of pages/slides/sheets
    word_count = db.Column(db.Integer, nullable=True)  # Total word count
    
    # Metadata
    file_metadata = db.Column(db.JSON, default=dict)  # pages, word_count, etc.
    error_message = db.Column(db.Text, nullable=True)
    
    # Relationships
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime, nullable=True)
    embedding_started_at = db.Column(db.DateTime, nullable=True)
    embedding_completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    project = db.relationship('Project', back_populates='documents')
    uploader = db.relationship('User', foreign_keys=[uploaded_by])
    questions = db.relationship('Question', back_populates='document')
    
    def to_dict(self):
        """Serialize document to dictionary."""
        return {
            'id': self.id,
            'file_id': self.file_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_url': self.file_url,
            'storage_type': self.storage_type,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'content_type': self.content_type,
            'status': self.status,
            'embedding_status': self.embedding_status,
            'chunk_count': self.chunk_count,
            'page_count': self.page_count,
            'word_count': self.word_count,
            'metadata': self.file_metadata,
            'error_message': self.error_message,
            'project_id': self.project_id,
            'uploaded_by': self.uploaded_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'embedding_completed_at': self.embedding_completed_at.isoformat() if self.embedding_completed_at else None,
            'question_count': len(self.questions) if self.questions else 0
        }
    
    def to_storage_metadata(self):
        """Get metadata for storage service."""
        return {
            'file_id': self.file_id,
            'file_name': self.filename,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'file_url': self.file_url,
            'uploaded_at': self.created_at.isoformat() if self.created_at else None,
            'status': self.status,
            'project_id': self.project_id,
            'uploaded_by': self.uploaded_by
        }

