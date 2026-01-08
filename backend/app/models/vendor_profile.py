"""Vendor Profile Model - Stores comprehensive company information for RFP generation."""
from datetime import datetime
from ..extensions import db


class VendorProfile(db.Model):
    """Main vendor profile containing company overview and basic information."""
    __tablename__ = 'vendor_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, unique=True)
    
    # Basic Company Information
    company_name = db.Column(db.String(255), nullable=True)
    registration_country = db.Column(db.String(100), nullable=True)
    years_in_business = db.Column(db.Integer, nullable=True)
    company_description = db.Column(db.Text, nullable=True)
    
    # Business Details
    industries_served = db.Column(db.JSON, default=list)  # ["Technology", "Healthcare", "Finance"]
    certifications = db.Column(db.JSON, default=list)  # ["ISO 27001", "SOC 2 Type II"]
    employee_count_range = db.Column(db.String(50), nullable=True)  # "50-100", "100-500", etc.
    annual_revenue_range = db.Column(db.String(50), nullable=True)  # "$1M-$5M", "$5M-$10M"
    headquarters_location = db.Column(db.String(255), nullable=True)
    office_locations = db.Column(db.JSON, default=list)  # ["New York, USA", "London, UK"]
    
    # Company Overview
    mission_statement = db.Column(db.Text, nullable=True)
    value_proposition = db.Column(db.Text, nullable=True)
    key_differentiators = db.Column(db.JSON, default=list)  # ["AI-First", "24/7 Support"]
    
    # Quick Fill Source
    source_document_path = db.Column(db.String(500), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref=db.backref('vendor_profile', uselist=False))
    clients = db.relationship('VendorClient', backref='vendor_profile', lazy='dynamic', cascade='all, delete-orphan')
    success_stories = db.relationship('VendorSuccessStory', backref='vendor_profile', lazy='dynamic', cascade='all, delete-orphan')
    capabilities = db.relationship('VendorCapability', backref='vendor_profile', lazy='dynamic', cascade='all, delete-orphan')
    testimonials = db.relationship('VendorTestimonial', backref='vendor_profile', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'company_name': self.company_name,
            'registration_country': self.registration_country,
            'years_in_business': self.years_in_business,
            'company_description': self.company_description,
            'industries_served': self.industries_served,
            'certifications': self.certifications,
            'employee_count_range': self.employee_count_range,
            'annual_revenue_range': self.annual_revenue_range,
            'headquarters_location': self.headquarters_location,
            'office_locations': self.office_locations,
            'mission_statement': self.mission_statement,
            'value_proposition': self.value_proposition,
            'key_differentiators': self.key_differentiators,
            'source_document_path': self.source_document_path,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
