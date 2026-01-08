"""Vendor Client Model - Stores client portfolio information."""
from datetime import datetime
from ..extensions import db


class VendorClient(db.Model):
    """Client portfolio entries showing past and ongoing clients."""
    __tablename__ = 'vendor_clients'
    
    id = db.Column(db.Integer, primary_key=True)
    vendor_profile_id = db.Column(db.Integer, db.ForeignKey('vendor_profiles.id'), nullable=False)
    
    # Client Information
    client_name = db.Column(db.String(255), nullable=False)
    client_industry = db.Column(db.String(100), nullable=True)
    client_size = db.Column(db.String(50), nullable=True)  # small, medium, enterprise, fortune500
    client_location = db.Column(db.String(255), nullable=True)
    client_type = db.Column(db.String(50), nullable=True)  # government, private, ngo, startup
    
    # Relationship Details
    relationship_status = db.Column(db.String(50), default='ongoing')  # ongoing, completed, paused
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    project_count = db.Column(db.Integer, default=1)
    
    # Project Overview
    services_provided = db.Column(db.JSON, default=list)  # ["Cloud Migration", "AI Implementation"]
    technologies_used = db.Column(db.JSON, default=list)  # ["AWS", "Python", "React"]
    project_value_range = db.Column(db.String(50), nullable=True)  # "$100K-$500K"
    
    # Reference & Visibility
    is_reference_available = db.Column(db.Boolean, default=False)
    is_public = db.Column(db.Boolean, default=True)  # Can be mentioned in proposals
    anonymize_name = db.Column(db.Boolean, default=False)  # Show as "Fortune 500 Tech Company"
    
    # Additional Info
    logo_url = db.Column(db.String(500), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'vendor_profile_id': self.vendor_profile_id,
            'client_name': self.client_name if not self.anonymize_name else f"{self.client_size.title()} {self.client_industry} Company",
            'client_industry': self.client_industry,
            'client_size': self.client_size,
            'client_location': self.client_location,
            'client_type': self.client_type,
            'relationship_status': self.relationship_status,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'project_count': self.project_count,
            'services_provided': self.services_provided,
            'technologies_used': self.technologies_used,
            'project_value_range': self.project_value_range,
            'is_reference_available': self.is_reference_available,
            'is_public': self.is_public,
            'anonymize_name': self.anonymize_name,
            'logo_url': self.logo_url,
            'website': self.website,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
