"""Vendor Testimonial Model - Client testimonials and reviews."""
from datetime import datetime
from ..extensions import db


class VendorTestimonial(db.Model):
    """Client testimonials and reviews."""
    __tablename__ = 'vendor_testimonials'
    
    id = db.Column(db.Integer, primary_key=True)
    vendor_profile_id = db.Column(db.Integer, db.ForeignKey('vendor_profiles.id'), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('vendor_clients.id'), nullable=True)
    
    # Testimonial Content
    testimonial_text = db.Column(db.Text, nullable=False)
    
    # Client Information
    client_name = db.Column(db.String(255), nullable=True)
    client_designation = db.Column(db.String(255), nullable=True)  # "CTO", "VP of Engineering"
    client_company = db.Column(db.String(255), nullable=True)
    client_industry = db.Column(db.String(100), nullable=True)
    
    # Rating & Metrics
    rating = db.Column(db.Float, nullable=True)  # 1-5 stars
    project_category = db.Column(db.String(100), nullable=True)  # What was the project about
    
    # Verification
    is_verified = db.Column(db.Boolean, default=False)
    verification_method = db.Column(db.String(50), nullable=True)  # "email", "linkedin", "document"
    verification_date = db.Column(db.DateTime, nullable=True)
    
    # Display Options
    is_featured = db.Column(db.Boolean, default=False)
    is_public = db.Column(db.Boolean, default=True)
    display_order = db.Column(db.Integer, default=0)
    
    # Source
    source_platform = db.Column(db.String(100), nullable=True)  # "LinkedIn", "G2", "Direct"
    source_url = db.Column(db.String(500), nullable=True)
    
    # Timestamps
    date_provided = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    client = db.relationship('VendorClient', backref='testimonials')
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'vendor_profile_id': self.vendor_profile_id,
            'client_id': self.client_id,
            'testimonial_text': self.testimonial_text,
            'client_name': self.client_name,
            'client_designation': self.client_designation,
            'client_company': self.client_company,
            'client_industry': self.client_industry,
            'rating': self.rating,
            'project_category': self.project_category,
            'is_verified': self.is_verified,
            'verification_method': self.verification_method,
            'verification_date': self.verification_date.isoformat() if self.verification_date else None,
            'is_featured': self.is_featured,
            'is_public': self.is_public,
            'display_order': self.display_order,
            'source_platform': self.source_platform,
            'source_url': self.source_url,
            'date_provided': self.date_provided.isoformat() if self.date_provided else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
