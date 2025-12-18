"""
Filter Dimension Model for Dynamic Knowledge Base Filtering.

Stores filterable dimension values in the database for:
- Geographies (US, EU, APAC, etc.)
- Client Types (government, private, NGO)
- Currencies (USD, EUR, GBP)
- Industries (healthcare, finance, defense)
- Compliance Frameworks (SOC2, ISO27001, GDPR)
"""
from datetime import datetime
from ..extensions import db


class FilterDimension(db.Model):
    """Filterable dimension value stored in database."""
    __tablename__ = 'filter_dimensions'
    
    id = db.Column(db.Integer, primary_key=True)
    dimension_type = db.Column(db.String(50), nullable=False, index=True)  # geography, client_type, currency, industry, compliance
    code = db.Column(db.String(50), nullable=False)  # US, government, USD
    name = db.Column(db.String(100), nullable=False)  # United States
    description = db.Column(db.Text, nullable=True)
    parent_code = db.Column(db.String(50), nullable=True)  # For hierarchical (US -> Americas)
    icon = db.Column(db.String(50), nullable=True)  # Optional icon/emoji
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    is_system = db.Column(db.Boolean, default=True)  # System-provided vs org-custom
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)  # Null = global/system
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: dimension_type + code + organization_id
    __table_args__ = (
        db.UniqueConstraint('dimension_type', 'code', 'organization_id', name='uq_dimension_type_code_org'),
    )
    
    def to_dict(self):
        """Serialize to dictionary."""
        return {
            'id': self.id,
            'dimension_type': self.dimension_type,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'parent_code': self.parent_code,
            'icon': self.icon,
            'sort_order': self.sort_order,
            'is_active': self.is_active,
            'is_system': self.is_system,
            'organization_id': self.organization_id,
        }


# Default dimension values to seed
DEFAULT_DIMENSIONS = {
    'geography': [
        {'code': 'GLOBAL', 'name': 'Global', 'icon': '🌍', 'sort_order': 0},
        {'code': 'US', 'name': 'United States', 'parent_code': 'AMERICAS', 'icon': '🇺🇸', 'sort_order': 1},
        {'code': 'EU', 'name': 'European Union', 'parent_code': 'EUROPE', 'icon': '🇪🇺', 'sort_order': 2},
        {'code': 'UK', 'name': 'United Kingdom', 'parent_code': 'EUROPE', 'icon': '🇬🇧', 'sort_order': 3},
        {'code': 'APAC', 'name': 'Asia Pacific', 'icon': '🌏', 'sort_order': 4},
        {'code': 'IN', 'name': 'India', 'parent_code': 'APAC', 'icon': '🇮🇳', 'sort_order': 5},
        {'code': 'MEA', 'name': 'Middle East & Africa', 'icon': '🌍', 'sort_order': 6},
        {'code': 'LATAM', 'name': 'Latin America', 'icon': '🌎', 'sort_order': 7},
    ],
    'client_type': [
        {'code': 'government', 'name': 'Government', 'description': 'Federal, State, Local government', 'icon': '🏛️', 'sort_order': 0},
        {'code': 'private', 'name': 'Private Sector', 'description': 'Private companies', 'icon': '🏢', 'sort_order': 1},
        {'code': 'enterprise', 'name': 'Enterprise', 'description': 'Large corporations', 'icon': '🏦', 'sort_order': 2},
        {'code': 'public_sector', 'name': 'Public Sector', 'description': 'Public institutions', 'icon': '🏫', 'sort_order': 3},
        {'code': 'ngo', 'name': 'NGO', 'description': 'Non-profit organizations', 'icon': '🤝', 'sort_order': 4},
        {'code': 'smb', 'name': 'SMB', 'description': 'Small & Medium Business', 'icon': '🏪', 'sort_order': 5},
    ],
    'currency': [
        {'code': 'USD', 'name': 'US Dollar', 'description': '$', 'icon': '💵', 'sort_order': 0},
        {'code': 'EUR', 'name': 'Euro', 'description': '€', 'icon': '💶', 'sort_order': 1},
        {'code': 'GBP', 'name': 'British Pound', 'description': '£', 'icon': '💷', 'sort_order': 2},
        {'code': 'INR', 'name': 'Indian Rupee', 'description': '₹', 'icon': '💰', 'sort_order': 3},
        {'code': 'JPY', 'name': 'Japanese Yen', 'description': '¥', 'icon': '💴', 'sort_order': 4},
    ],
    'industry': [
        {'code': 'healthcare', 'name': 'Healthcare', 'description': 'Healthcare & Life Sciences', 'icon': '🏥', 'sort_order': 0},
        {'code': 'finance', 'name': 'Financial Services', 'description': 'Banking & Financial Services', 'icon': '🏦', 'sort_order': 1},
        {'code': 'technology', 'name': 'Technology', 'description': 'Technology & Software', 'icon': '💻', 'sort_order': 2},
        {'code': 'defense', 'name': 'Defense & Aerospace', 'description': 'Defense, Aerospace & Security', 'icon': '🛡️', 'sort_order': 3},
        {'code': 'manufacturing', 'name': 'Manufacturing', 'description': 'Manufacturing & Industrial', 'icon': '🏭', 'sort_order': 4},
        {'code': 'energy', 'name': 'Energy & Utilities', 'description': 'Energy, Oil & Gas, Utilities', 'icon': '⚡', 'sort_order': 5},
    ],
    'compliance': [
        {'code': 'SOC2', 'name': 'SOC 2', 'description': 'Service Organization Control 2', 'icon': '🔒', 'sort_order': 0},
        {'code': 'ISO27001', 'name': 'ISO 27001', 'description': 'Information Security Management', 'icon': '📜', 'sort_order': 1},
        {'code': 'GDPR', 'name': 'GDPR', 'description': 'General Data Protection Regulation', 'icon': '🇪🇺', 'sort_order': 2},
        {'code': 'HIPAA', 'name': 'HIPAA', 'description': 'Health Insurance Portability', 'icon': '🏥', 'sort_order': 3},
        {'code': 'FedRAMP', 'name': 'FedRAMP', 'description': 'Federal Risk Authorization', 'icon': '🇺🇸', 'sort_order': 4},
        {'code': 'PCI_DSS', 'name': 'PCI DSS', 'description': 'Payment Card Industry', 'icon': '💳', 'sort_order': 5},
    ],
}


def seed_filter_dimensions(db_session):
    """Seed default filter dimensions if they don't exist."""
    from sqlalchemy.exc import IntegrityError
    
    count = 0
    for dimension_type, values in DEFAULT_DIMENSIONS.items():
        for value_data in values:
            # Check if exists (system-level, no org)
            existing = FilterDimension.query.filter_by(
                dimension_type=dimension_type,
                code=value_data['code'],
                organization_id=None
            ).first()
            
            if not existing:
                dimension = FilterDimension(
                    dimension_type=dimension_type,
                    is_system=True,
                    organization_id=None,
                    **value_data
                )
                db_session.add(dimension)
                count += 1
    
    try:
        db_session.commit()
        if count > 0:
            print(f"Seeded {count} filter dimensions")
    except IntegrityError:
        db_session.rollback()
        print("Filter dimensions already exist, skipping seed")
