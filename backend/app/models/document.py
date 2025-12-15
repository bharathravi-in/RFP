from datetime import datetime
from ..extensions import db


class Document(db.Model):
    """Document model for uploaded RFP/RFI files."""
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=True)  # Optional - for filesystem storage
    file_data = db.Column(db.LargeBinary, nullable=True)  # Store file content in DB
    file_type = db.Column(db.String(50), nullable=False)  # pdf, docx, xlsx
    file_size = db.Column(db.Integer, nullable=True)  # bytes
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    extracted_text = db.Column(db.Text, nullable=True)
    file_metadata = db.Column(db.JSON, default=dict)  # pages, word_count, etc.
    error_message = db.Column(db.Text, nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    project = db.relationship('Project', back_populates='documents')
    uploader = db.relationship('User', foreign_keys=[uploaded_by])
    questions = db.relationship('Question', back_populates='document')
    
    def to_dict(self):
        """Serialize document to dictionary."""
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'status': self.status,
            'metadata': self.file_metadata,
            'error_message': self.error_message,
            'project_id': self.project_id,
            'uploaded_by': self.uploaded_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'question_count': len(self.questions) if self.questions else 0
        }

