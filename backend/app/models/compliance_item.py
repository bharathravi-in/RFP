"""Compliance Item model for tracking RFP requirement compliance."""
from datetime import datetime
from ..extensions import db


class ComplianceItem(db.Model):
    """Model for tracking compliance with RFP requirements."""
    __tablename__ = 'compliance_items'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    
    # Requirement details
    requirement_id = db.Column(db.String(50), nullable=True)  # e.g., "REQ-001", "3.2.1"
    requirement_text = db.Column(db.Text, nullable=False)  # The actual requirement
    source = db.Column(db.String(255), nullable=True)  # Document name, page number
    category = db.Column(db.String(100), nullable=True)  # technical, legal, security, pricing, operational
    
    # Compliance tracking
    compliance_status = db.Column(
        db.String(20), 
        default='pending'
    )  # compliant, partial, non_compliant, not_applicable, pending
    
    # Response and notes
    section_id = db.Column(db.Integer, db.ForeignKey('rfp_sections.id'), nullable=True)
    response_summary = db.Column(db.Text, nullable=True)  # Brief compliance response
    notes = db.Column(db.Text, nullable=True)  # Internal notes
    
    # Metadata
    priority = db.Column(db.String(20), default='normal')  # high, normal, low
    order = db.Column(db.Integer, default=0)  # Display order
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref=db.backref('compliance_items', lazy='dynamic'))
    section = db.relationship('RFPSection', backref=db.backref('compliance_items', lazy='dynamic'))
    
    def to_dict(self, include_section=False):
        """Serialize compliance item to dictionary."""
        data = {
            'id': self.id,
            'project_id': self.project_id,
            'requirement_id': self.requirement_id,
            'requirement_text': self.requirement_text,
            'source': self.source,
            'category': self.category,
            'compliance_status': self.compliance_status,
            'section_id': self.section_id,
            'response_summary': self.response_summary,
            'notes': self.notes,
            'priority': self.priority,
            'order': self.order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_section and self.section:
            data['section'] = {
                'id': self.section.id,
                'title': self.section.title,
                'status': self.section.status,
            }
        
        return data
