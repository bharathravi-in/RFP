"""Proposal Version model for storing exported document snapshots."""
from datetime import datetime
from ..extensions import db


class ProposalVersion(db.Model):
    """Model for storing proposal document versions/snapshots."""
    __tablename__ = 'proposal_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)  # Auto-incremented per project
    title = db.Column(db.String(255), nullable=False)  # e.g., "Draft v1", "Final Review"
    description = db.Column(db.Text, nullable=True)  # Optional notes
    file_data = db.Column(db.LargeBinary, nullable=False)  # DOCX binary content
    file_type = db.Column(db.String(10), default='docx')
    file_size = db.Column(db.Integer)
    # Sections snapshot for restoration - stores all section data as JSON
    sections_snapshot = db.Column(db.JSON, nullable=True)  # Section content for restore
    is_restoration_point = db.Column(db.Boolean, default=False)  # True if created by restore
    restored_from_version = db.Column(db.Integer, nullable=True)  # Source version if restored
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref=db.backref('versions', lazy='dynamic'))
    creator = db.relationship('User', foreign_keys=[created_by])
    
    @property
    def can_restore(self):
        """Check if this version can be restored (has section snapshot)."""
        return self.sections_snapshot is not None and len(self.sections_snapshot) > 0
    
    def to_dict(self):
        """Serialize version to dictionary."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'version_number': self.version_number,
            'title': self.title,
            'description': self.description,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'can_restore': self.can_restore,
            'is_restoration_point': self.is_restoration_point or False,
            'restored_from_version': self.restored_from_version,
            'created_by': self.created_by,
            'creator_name': self.creator.name if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
