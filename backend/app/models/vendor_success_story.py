"""Vendor Success Story Model - Case studies and project highlights."""
from datetime import datetime
from ..extensions import db


class VendorSuccessStory(db.Model):
    """Success stories and case studies for showcasing in RFP responses."""
    __tablename__ = 'vendor_success_stories'
    
    id = db.Column(db.Integer, primary_key=True)
    vendor_profile_id = db.Column(db.Integer, db.ForeignKey('vendor_profiles.id'), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('vendor_clients.id'), nullable=True)
    
    # Story Information
    title = db.Column(db.String(255), nullable=False)
    client_name = db.Column(db.String(255), nullable=True)  # Can be anonymized
    industry = db.Column(db.String(100), nullable=True)
    client_size = db.Column(db.String(50), nullable=True)
    
    # Case Study Structure
    challenge = db.Column(db.Text, nullable=True)  # What problem did the client have?
    solution = db.Column(db.Text, nullable=True)  # What did you implement?
    impact = db.Column(db.Text, nullable=True)  # What were the results?
    
    # Metrics & Results
    impact_metrics = db.Column(db.JSON, default=dict)
    # Example: {
    #   "revenue_increase": {"value": 40, "unit": "%"},
    #   "cost_reduction": {"value": 2000000, "unit": "$"},
    #   "time_saved": {"value": 500, "unit": "hours/month"},
    #   "user_growth": {"value": 2000000, "unit": "users"}
    # }
    
    # Project Details
    technologies_used = db.Column(db.JSON, default=list)  # ["Python", "AWS", "React"]
    methodologies = db.Column(db.JSON, default=list)  # ["Agile", "DevOps"]
    project_duration_months = db.Column(db.Integer, nullable=True)
    team_size = db.Column(db.Integer, nullable=True)
    budget_range = db.Column(db.String(50), nullable=True)
    
    # Classification & Tagging
    tags = db.Column(db.JSON, default=list)  # ["AI", "Cloud Migration", "E-commerce"]
    services_provided = db.Column(db.JSON, default=list)  # ["Consulting", "Development"]
    industry_vertical = db.Column(db.String(100), nullable=True)
    
    # Visibility & Highlighting
    is_public = db.Column(db.Boolean, default=True)
    is_featured = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, default=0)
    
    # Attachments
    document_url = db.Column(db.String(500), nullable=True)  # Full PDF case study
    images = db.Column(db.JSON, default=list)  # Screenshot URLs
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    client = db.relationship('VendorClient', backref='success_stories')
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'vendor_profile_id': self.vendor_profile_id,
            'client_id': self.client_id,
            'title': self.title,
            'client_name': self.client_name,
            'industry': self.industry,
            'client_size': self.client_size,
            'challenge': self.challenge,
            'solution': self.solution,
            'impact': self.impact,
            'impact_metrics': self.impact_metrics,
            'technologies_used': self.technologies_used,
            'methodologies': self.methodologies,
            'project_duration_months': self.project_duration_months,
            'team_size': self.team_size,
            'budget_range': self.budget_range,
            'tags': self.tags,
            'services_provided': self.services_provided,
            'industry_vertical': self.industry_vertical,
            'is_public': self.is_public,
            'is_featured': self.is_featured,
            'display_order': self.display_order,
            'document_url': self.document_url,
            'images': self.images,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def format_for_llm(self):
        """Format success story for LLM context injection."""
        metrics_text = ""
        if self.impact_metrics:
            metrics_list = [f"{k.replace('_', ' ').title()}: {v.get('value')}{v.get('unit', '')}" 
                          for k, v in self.impact_metrics.items()]
            metrics_text = ", ".join(metrics_list)
        
        return f"""
Success Story: {self.title}
Client: {self.client_name} ({self.industry}, {self.client_size})
Challenge: {self.challenge}
Solution: {self.solution}
Impact: {self.impact}
Measurable Results: {metrics_text}
Technologies: {', '.join(self.technologies_used)}
Duration: {self.project_duration_months} months
Team Size: {self.team_size} people
""".strip()
