"""Export Template Model for storing DOCX/PPTX template files."""
from datetime import datetime
from app import db


class ExportTemplate(db.Model):
    """Model for storing export templates (DOCX/PPTX)."""
    
    __tablename__ = 'export_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    template_type = db.Column(db.String(20), nullable=False)  # 'docx', 'pptx'
    file_path = db.Column(db.String(500), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer)  # Size in bytes
    is_default = db.Column(db.Boolean, default=False)
    
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = db.relationship('Organization', backref=db.backref('export_templates', lazy='dynamic'))
    created_by = db.relationship('User', backref=db.backref('export_templates_created', lazy='dynamic'))

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'template_type': self.template_type,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'is_default': self.is_default,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by.name if self.created_by else None,
        }
