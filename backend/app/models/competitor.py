"""
Competitor Model

Stores competitor information for competitive analysis.
"""
from datetime import datetime
from ..extensions import db


class Competitor(db.Model):
    """Competitor entity for competitive analysis."""
    __tablename__ = 'competitors'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    
    # Basic info
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    website = db.Column(db.String(255), nullable=True)
    
    # Competitive intelligence
    strengths = db.Column(db.JSON, default=list)  # ["Strong brand", "Large team"]
    weaknesses = db.Column(db.JSON, default=list)  # ["High pricing", "Slow delivery"]
    pricing_tier = db.Column(db.String(50), nullable=True)  # premium, mid-market, budget
    market_position = db.Column(db.String(100), nullable=True)  # leader, challenger, niche
    
    # Industry focus
    industries = db.Column(db.JSON, default=list)  # ["healthcare", "finance"]
    geographies = db.Column(db.JSON, default=list)  # ["US", "EU"]
    client_types = db.Column(db.JSON, default=list)  # ["enterprise", "government"]
    
    # Products/Services
    products = db.Column(db.JSON, default=list)  # Product names
    key_differentiators = db.Column(db.JSON, default=list)  # What makes them different
    
    # Win/Loss tracking against this competitor
    wins_against = db.Column(db.Integer, default=0)  # Times we won against them
    losses_against = db.Column(db.Integer, default=0)  # Times we lost to them
    last_encounter_date = db.Column(db.DateTime, nullable=True)
    
    # Notes and intelligence
    notes = db.Column(db.Text, nullable=True)  # General competitive notes
    counter_strategies = db.Column(db.JSON, default=list)  # How to win against them
    
    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref=db.backref('competitors', lazy='dynamic'))
    
    def to_dict(self):
        """Serialize competitor to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'website': self.website,
            'strengths': self.strengths or [],
            'weaknesses': self.weaknesses or [],
            'pricing_tier': self.pricing_tier,
            'market_position': self.market_position,
            'industries': self.industries or [],
            'geographies': self.geographies or [],
            'client_types': self.client_types or [],
            'products': self.products or [],
            'key_differentiators': self.key_differentiators or [],
            'wins_against': self.wins_against,
            'losses_against': self.losses_against,
            'win_rate': self.wins_against / max(1, self.wins_against + self.losses_against),
            'last_encounter_date': self.last_encounter_date.isoformat() if self.last_encounter_date else None,
            'notes': self.notes,
            'counter_strategies': self.counter_strategies or [],
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @property
    def win_rate(self) -> float:
        """Calculate win rate against this competitor."""
        total = self.wins_against + self.losses_against
        return self.wins_against / total if total > 0 else 0.5
