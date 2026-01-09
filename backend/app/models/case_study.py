"""
Case Study Model

Stores real case studies from vendor's past projects for use in RFP proposals.
These are actual, verified client success stories that can be referenced.
"""
from datetime import datetime
from app.extensions import db


class CaseStudy(db.Model):
    """
    Represents a real case study from vendor's completed projects.
    
    Unlike AI-generated case studies, these are verified success stories
    that can be cited with confidence in proposals.
    """
    __tablename__ = 'case_studies'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    
    # Basic Info
    title = db.Column(db.String(255), nullable=False)
    summary = db.Column(db.Text)  # Brief summary (2-3 sentences)
    
    # Client Info (can be anonymized)
    client_name = db.Column(db.String(255))  # Can be "[Industry] Client" if confidential
    client_industry = db.Column(db.String(100))
    client_size = db.Column(db.String(50))  # Enterprise, Mid-Market, SMB
    client_geography = db.Column(db.String(100))
    is_client_public = db.Column(db.Boolean, default=False)  # Can we name the client?
    
    # Project Details
    challenge = db.Column(db.Text)  # What problem did client face?
    solution = db.Column(db.Text)  # How did we solve it?
    approach = db.Column(db.JSON)  # {"methodology": "Agile", "phases": [...]}
    
    # Results & Metrics
    results = db.Column(db.JSON)  # [{"metric": "ROI", "value": "150%", "description": "..."}]
    key_outcomes = db.Column(db.JSON)  # List of key outcomes
    
    # Technical Info
    technologies = db.Column(db.JSON)  # ["Python", "AWS", "React"]
    services = db.Column(db.JSON)  # ["Cloud Migration", "DevOps"]
    
    # Project Dimensions
    industry = db.Column(db.String(100))  # Primary industry
    project_type = db.Column(db.String(100))  # Digital Transformation, Migration, etc.
    duration_months = db.Column(db.Integer)
    team_size = db.Column(db.Integer)
    project_value = db.Column(db.String(50))  # $100K-500K, $500K-1M, etc.
    
    # Testimonial
    testimonial_text = db.Column(db.Text)
    testimonial_author = db.Column(db.String(255))
    testimonial_role = db.Column(db.String(100))
    
    # Verification & Status
    is_verified = db.Column(db.Boolean, default=False)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), default='draft')  # draft, active, archived
    
    # Reference Permission
    can_be_referenced = db.Column(db.Boolean, default=True)  # Can use in proposals
    reference_contact = db.Column(db.String(255))  # Who to contact for reference
    
    # Timestamps
    project_completion_date = db.Column(db.Date)  # When project completed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Relationships
    organization = db.relationship('Organization', backref=db.backref('case_studies', lazy='dynamic'))
    
    def to_dict(self):
        """Serialize case study for API responses."""
        return {
            'id': self.id,
            'title': self.title,
            'summary': self.summary,
            'client_name': self.client_name if self.is_client_public else f"[{self.client_industry}] Client",
            'client_industry': self.client_industry,
            'client_size': self.client_size,
            'client_geography': self.client_geography,
            'is_client_public': self.is_client_public,
            'challenge': self.challenge,
            'solution': self.solution,
            'approach': self.approach,
            'results': self.results or [],
            'key_outcomes': self.key_outcomes or [],
            'technologies': self.technologies or [],
            'services': self.services or [],
            'industry': self.industry,
            'project_type': self.project_type,
            'duration_months': self.duration_months,
            'team_size': self.team_size,
            'project_value': self.project_value,
            'testimonial': {
                'text': self.testimonial_text,
                'author': self.testimonial_author,
                'role': self.testimonial_role
            } if self.testimonial_text else None,
            'is_verified': self.is_verified,
            'status': self.status,
            'can_be_referenced': self.can_be_referenced,
            'project_completion_date': self.project_completion_date.isoformat() if self.project_completion_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    def to_context_dict(self):
        """
        Format for LLM context - enriched format for case study agent.
        """
        return {
            'case_id': f'KB-{self.id}',
            'title': self.title,
            'client_type': f"{self.client_industry} {self.client_size}" if self.client_industry else self.client_size,
            'client_name': self.client_name if self.is_client_public else f"[{self.client_industry}] Client",
            'challenge': self.challenge,
            'solution': self.solution,
            'approach': self.approach,
            'results': self.results or [],
            'technologies': self.technologies or [],
            'duration': f"{self.duration_months} months" if self.duration_months else None,
            'team_size': f"{self.team_size} professionals" if self.team_size else None,
            'key_differentiators': self.key_outcomes or [],
            'testimonial': {
                'quote': self.testimonial_text,
                'author': f"{self.testimonial_author}, {self.testimonial_role}"
            } if self.testimonial_text else None,
            'verification_status': 'FROM_KNOWLEDGE_BASE' if self.is_verified else 'ILLUSTRATIVE',
            'relevance_data': {
                'industry': self.industry,
                'project_type': self.project_type,
                'technologies': self.technologies,
                'services': self.services
            }
        }
    
    @classmethod
    def get_relevant_case_studies(
        cls,
        organization_id: int,
        industry: str = None,
        project_type: str = None,
        technologies: list = None,
        limit: int = 5
    ):
        """
        Get relevant case studies for a given context.
        
        Args:
            organization_id: Organization ID
            industry: Target industry (optional)
            project_type: Type of project (optional)
            technologies: List of technologies (optional)
            limit: Max case studies to return
            
        Returns:
            List of matching case studies ordered by relevance
        """
        query = cls.query.filter_by(
            organization_id=organization_id,
            status='active',
            can_be_referenced=True
        )
        
        # Filter by industry if provided
        if industry:
            # Prioritize exact matches, but include others
            query = query.filter(
                db.or_(
                    cls.industry.ilike(f'%{industry}%'),
                    cls.client_industry.ilike(f'%{industry}%')
                )
            )
        
        # Filter by project type if provided
        if project_type:
            query = query.filter(cls.project_type.ilike(f'%{project_type}%'))
        
        # Order by verified first, then most recent
        query = query.order_by(
            cls.is_verified.desc(),
            cls.project_completion_date.desc().nulls_last(),
            cls.created_at.desc()
        )
        
        return query.limit(limit).all()


def get_case_study_model():
    """Factory function for case study model."""
    return CaseStudy
