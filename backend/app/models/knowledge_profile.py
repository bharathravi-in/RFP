"""
Knowledge Profile Model for Multi-Dimensional Knowledge Base Filtering.

Supports filtering knowledge by Geography, Client Type, Currency, Industry,
and custom dimensions for MNC operations.
"""
from datetime import datetime
from ..extensions import db


# Association table for project-knowledge profile many-to-many
project_knowledge_profiles = db.Table(
    'project_knowledge_profiles',
    db.Column('project_id', db.Integer, db.ForeignKey('projects.id'), primary_key=True),
    db.Column('knowledge_profile_id', db.Integer, db.ForeignKey('knowledge_profiles.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)


class KnowledgeProfile(db.Model):
    """
    Knowledge Profile groups knowledge items by multiple dimensions.
    
    Enables filtering knowledge base for specific:
    - Geographies (US, EU, APAC, etc.)
    - Client Types (government, private, NGO)
    - Currencies (USD, EUR, GBP)
    - Industries (healthcare, finance, defense)
    - Compliance Frameworks (SOC2, ISO27001, GDPR)
    """
    __tablename__ = 'knowledge_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Multi-dimensional filtering fields (JSON arrays for flexibility)
    geographies = db.Column(db.JSON, default=list)  # ["US", "EU", "APAC"]
    client_types = db.Column(db.JSON, default=list)  # ["government", "private"]
    currencies = db.Column(db.JSON, default=list)  # ["USD", "EUR", "GBP"]
    industries = db.Column(db.JSON, default=list)  # ["healthcare", "finance"]
    compliance_frameworks = db.Column(db.JSON, default=list)  # ["SOC2", "GDPR"]
    languages = db.Column(db.JSON, default=list)  # ["en", "es", "de"]
    
    # Extensible custom tags (key-value pairs)
    custom_tags = db.Column(db.JSON, default=dict)
    
    # Profile settings
    is_default = db.Column(db.Boolean, default=False)  # Default profile for org
    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=0)  # Higher priority = preferred
    
    # Organization and ownership
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref='knowledge_profiles')
    creator = db.relationship('User', foreign_keys=[created_by])
    knowledge_items = db.relationship('KnowledgeItem', back_populates='profile', lazy='dynamic')
    
    def matches_dimensions(self, geography=None, client_type=None, currency=None, 
                          industry=None, compliance=None):
        """
        Check if this profile matches the given dimensions.
        Returns True if all provided dimensions match (or profile has no filter for that dimension).
        """
        if geography and self.geographies and geography not in self.geographies:
            return False
        if client_type and self.client_types and client_type not in self.client_types:
            return False
        if currency and self.currencies and currency not in self.currencies:
            return False
        if industry and self.industries and industry not in self.industries:
            return False
        if compliance and self.compliance_frameworks:
            if not any(c in self.compliance_frameworks for c in (compliance if isinstance(compliance, list) else [compliance])):
                return False
        return True
    
    def to_dict(self, include_items_count=False):
        """Serialize knowledge profile to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'geographies': self.geographies or [],
            'client_types': self.client_types or [],
            'currencies': self.currencies or [],
            'industries': self.industries or [],
            'compliance_frameworks': self.compliance_frameworks or [],
            'languages': self.languages or [],
            'custom_tags': self.custom_tags or {},
            'is_default': self.is_default,
            'is_active': self.is_active,
            'priority': self.priority,
            'organization_id': self.organization_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_items_count:
            data['items_count'] = self.knowledge_items.filter_by(is_active=True).count()
        
        return data


# Predefined dimension values
class DimensionValues:
    """Predefined values for knowledge dimensions."""
    
    GEOGRAPHIES = [
        {'code': 'GLOBAL', 'name': 'Global', 'region': None},
        {'code': 'US', 'name': 'United States', 'region': 'Americas'},
        {'code': 'CA', 'name': 'Canada', 'region': 'Americas'},
        {'code': 'LATAM', 'name': 'Latin America', 'region': 'Americas'},
        {'code': 'EU', 'name': 'European Union', 'region': 'Europe'},
        {'code': 'UK', 'name': 'United Kingdom', 'region': 'Europe'},
        {'code': 'DE', 'name': 'Germany', 'region': 'Europe'},
        {'code': 'FR', 'name': 'France', 'region': 'Europe'},
        {'code': 'APAC', 'name': 'Asia Pacific', 'region': 'Asia'},
        {'code': 'IN', 'name': 'India', 'region': 'Asia'},
        {'code': 'CN', 'name': 'China', 'region': 'Asia'},
        {'code': 'JP', 'name': 'Japan', 'region': 'Asia'},
        {'code': 'SG', 'name': 'Singapore', 'region': 'Asia'},
        {'code': 'ANZ', 'name': 'Australia & New Zealand', 'region': 'Oceania'},
        {'code': 'MEA', 'name': 'Middle East & Africa', 'region': 'MEA'},
        {'code': 'UAE', 'name': 'United Arab Emirates', 'region': 'MEA'},
    ]
    
    CLIENT_TYPES = [
        {'code': 'government', 'name': 'Government', 'description': 'Federal, State, Local government'},
        {'code': 'public_sector', 'name': 'Public Sector', 'description': 'Public institutions'},
        {'code': 'private', 'name': 'Private Sector', 'description': 'Private companies'},
        {'code': 'enterprise', 'name': 'Enterprise', 'description': 'Large corporations'},
        {'code': 'smb', 'name': 'SMB', 'description': 'Small & Medium Business'},
        {'code': 'startup', 'name': 'Startup', 'description': 'Early-stage companies'},
        {'code': 'ngo', 'name': 'NGO', 'description': 'Non-profit organizations'},
        {'code': 'education', 'name': 'Education', 'description': 'Educational institutions'},
    ]
    
    CURRENCIES = [
        {'code': 'USD', 'name': 'US Dollar', 'symbol': '$'},
        {'code': 'EUR', 'name': 'Euro', 'symbol': '€'},
        {'code': 'GBP', 'name': 'British Pound', 'symbol': '£'},
        {'code': 'INR', 'name': 'Indian Rupee', 'symbol': '₹'},
        {'code': 'JPY', 'name': 'Japanese Yen', 'symbol': '¥'},
        {'code': 'CNY', 'name': 'Chinese Yuan', 'symbol': '¥'},
        {'code': 'AUD', 'name': 'Australian Dollar', 'symbol': 'A$'},
        {'code': 'CAD', 'name': 'Canadian Dollar', 'symbol': 'C$'},
        {'code': 'CHF', 'name': 'Swiss Franc', 'symbol': 'CHF'},
        {'code': 'SGD', 'name': 'Singapore Dollar', 'symbol': 'S$'},
        {'code': 'AED', 'name': 'UAE Dirham', 'symbol': 'د.إ'},
    ]
    
    INDUSTRIES = [
        {'code': 'healthcare', 'name': 'Healthcare & Life Sciences'},
        {'code': 'finance', 'name': 'Financial Services & Banking'},
        {'code': 'technology', 'name': 'Technology & Software'},
        {'code': 'manufacturing', 'name': 'Manufacturing'},
        {'code': 'retail', 'name': 'Retail & Consumer Goods'},
        {'code': 'energy', 'name': 'Energy & Utilities'},
        {'code': 'defense', 'name': 'Defense & Aerospace'},
        {'code': 'telecom', 'name': 'Telecommunications'},
        {'code': 'logistics', 'name': 'Logistics & Transportation'},
        {'code': 'media', 'name': 'Media & Entertainment'},
        {'code': 'real_estate', 'name': 'Real Estate & Construction'},
        {'code': 'pharma', 'name': 'Pharmaceuticals'},
    ]
    
    COMPLIANCE_FRAMEWORKS = [
        {'code': 'SOC2', 'name': 'SOC 2', 'description': 'Service Organization Control 2'},
        {'code': 'ISO27001', 'name': 'ISO 27001', 'description': 'Information Security Management'},
        {'code': 'GDPR', 'name': 'GDPR', 'description': 'General Data Protection Regulation'},
        {'code': 'HIPAA', 'name': 'HIPAA', 'description': 'Health Insurance Portability'},
        {'code': 'PCI_DSS', 'name': 'PCI DSS', 'description': 'Payment Card Industry'},
        {'code': 'FedRAMP', 'name': 'FedRAMP', 'description': 'Federal Risk Authorization'},
        {'code': 'NIST', 'name': 'NIST', 'description': 'National Institute of Standards'},
        {'code': 'CCPA', 'name': 'CCPA', 'description': 'California Consumer Privacy Act'},
        {'code': 'SOX', 'name': 'SOX', 'description': 'Sarbanes-Oxley Act'},
        {'code': 'ITAR', 'name': 'ITAR', 'description': 'International Traffic in Arms'},
    ]
