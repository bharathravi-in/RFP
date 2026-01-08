"""Vendor Capability Model - Service offerings and expertise areas."""
from datetime import datetime
from ..extensions import db


class VendorCapability(db.Model):
    """Vendor capabilities and service offerings."""
    __tablename__ = 'vendor_capabilities'
    
    id = db.Column(db.Integer, primary_key=True)
    vendor_profile_id = db.Column(db.Integer, db.ForeignKey('vendor_profiles.id'), nullable=False)
    
    # Capability Information
    capability_name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=True)  # "Development", "Consulting", "Support"
    description = db.Column(db.Text, nullable=True)
    
    # Experience & Expertise
    years_of_experience = db.Column(db.Integer, nullable=True)
    expertise_level = db.Column(db.String(50), default='intermediate')  # beginner, intermediate, expert
    key_projects_count = db.Column(db.Integer, default=0)
    
    # Technologies & Tools
    technologies = db.Column(db.JSON, default=list)  # ["Python", "AWS", "Docker"]
    tools = db.Column(db.JSON, default=list)  # ["Jira", "GitHub", "Jenkins"]
    
    # Certifications & Standards
    certifications = db.Column(db.JSON, default=list)  # ["AWS Certified", "Google Cloud Professional"]
    compliance_standards = db.Column(db.JSON, default=list)  # ["SOC 2", "ISO 27001"]
    
    # Performance Metrics
    success_rate = db.Column(db.Float, nullable=True)  # 0-100%
    client_satisfaction = db.Column(db.Float, nullable=True)  # 0-5 rating
    delivery_success = db.Column(db.Float, nullable=True)  # % on-time delivery
    
    # Team & Resources
    team_size = db.Column(db.Integer, nullable=True)
    availability = db.Column(db.String(50), nullable=True)  # "Immediately", "2-4 weeks"
    
    # Service Details
    service_locations = db.Column(db.JSON, default=list)  # ["Remote", "US", "EU"]
    languages_supported = db.Column(db.JSON, default=list)  # ["English", "Spanish"]
    
    # Visibility
    is_core_capability = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'vendor_profile_id': self.vendor_profile_id,
            'capability_name': self.capability_name,
            'category': self.category,
            'description': self.description,
            'years_of_experience': self.years_of_experience,
            'expertise_level': self.expertise_level,
            'key_projects_count': self.key_projects_count,
            'technologies': self.technologies,
            'tools': self.tools,
            'certifications': self.certifications,
            'compliance_standards': self.compliance_standards,
            'success_rate': self.success_rate,
            'client_satisfaction': self.client_satisfaction,
            'delivery_success': self.delivery_success,
            'team_size': self.team_size,
            'availability': self.availability,
            'service_locations': self.service_locations,
            'languages_supported': self.languages_supported,
            'is_core_capability': self.is_core_capability,
            'display_order': self.display_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
