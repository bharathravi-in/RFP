"""Proposal Template Model for marketplace."""
from datetime import datetime
from ..extensions import db


class ProposalTemplate(db.Model):
    """
    Marketplace template for initializing new proposals.
    
    Contains structure (sections, questions) and starter content.
    Used to quickly spin up industry-specific or standard proposals (e.g. SalesForce Security Questionnaire).
    """
    
    __tablename__ = 'proposal_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Metadata
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100))  # e.g., 'Security', 'government', 'SaaS'
    tags = db.Column(db.JSON, default=list)  # e.g., ['soc2', 'intro']
    
    # Content structure
    # JSON containing sections, questions, and default answers
    # Schema:
    # {
    #   "sections": [
    #     {
    #       "title": "Security Overview",
    #       "questions": [
    #         {"text": "Do you have SOC 2 Type II?", "default_answer": "Yes, we are SOC 2 Type II compliant."}
    #       ]
    #     }
    #   ]
    # }
    content_structure = db.Column(db.JSON, nullable=False)
    
    # Marketplace stats
    install_count = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=0.0)
    
    # Visibility
    is_public = db.Column(db.Boolean, default=True)  # Public marketplace vs internal only
    is_premium = db.Column(db.Boolean, default=False)
    price = db.Column(db.Float, default=0.0)
    
    # Ownership
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Null means system template
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)  # Null means global
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = db.relationship('User', foreign_keys=[created_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'tags': self.tags or [],
            'install_count': self.install_count,
            'rating': self.rating,
            'is_premium': self.is_premium,
            'price': self.price,
            'author_name': self.author.name if self.author else 'RFP Pro System',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_system': self.organization_id is None
        }
