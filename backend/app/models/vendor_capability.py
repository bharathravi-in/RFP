"""Vendor Capability Model - Accelerators and POCs."""
from datetime import datetime
from ..extensions import db


class VendorCapability(db.Model):
    """Vendor accelerators, POCs, and ready-to-use solutions."""
    __tablename__ = 'vendor_capabilities'
    
    id = db.Column(db.Integer, primary_key=True)
    vendor_profile_id = db.Column(db.Integer, db.ForeignKey('vendor_profiles.id'), nullable=False)
    organization_id = db.Column(db.Integer, nullable=False)
    
    # Accelerator Information
    capability_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Technical Details
    technologies_used = db.Column(db.JSON, default=list)  # ["Python", "React", "PostgreSQL"]
    use_cases = db.Column(db.Text, nullable=True)  # Detailed use case description
    
    # Value Proposition
    time_saved = db.Column(db.String(100), nullable=True)  # "2-3 weeks", "40% reduction"
    demo_link = db.Column(db.String(500), nullable=True)  # URL to demo/POC
    
    # Visibility
    display_order = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'vendor_profile_id': self.vendor_profile_id,
            'organization_id': self.organization_id,
            'capability_name': self.capability_name,
            'description': self.description,
            'technologies_used': self.technologies_used,
            'use_cases': self.use_cases,
            'time_saved': self.time_saved,
            'demo_link': self.demo_link,
            'display_order': self.display_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
