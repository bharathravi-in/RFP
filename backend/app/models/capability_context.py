"""
Capability Context Model

Stores client context and capability alignment data for 
Capability-Led Proposals (vendor-driven, sales-led proposals without RFP).
"""
from datetime import datetime
from app.extensions import db


class CapabilityContext(db.Model):
    """
    Stores client context for capability-led proposals.
    
    This model captures:
    - Client information from meeting notes
    - Capability alignment (client needs ↔ vendor strengths)
    - Footprints and proof points
    - Win-win value propositions
    """
    __tablename__ = 'capability_contexts'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, unique=True)
    
    # ─────────────────────────────────────────────────────────────────────────
    # Client Information (from meeting / user input)
    # ─────────────────────────────────────────────────────────────────────────
    client_product = db.Column(db.Text)  # What product/service does client offer?
    client_domain = db.Column(db.String(100))  # Industry/domain
    client_challenges = db.Column(db.JSON)  # List of current challenges
    client_goals = db.Column(db.JSON)  # Strategic goals
    meeting_notes = db.Column(db.Text)  # Raw meeting notes (free text)
    meeting_date = db.Column(db.Date)  # When the meeting happened
    key_stakeholders = db.Column(db.JSON)  # [{"name": "...", "role": "...", "notes": "..."}]
    
    # ─────────────────────────────────────────────────────────────────────────
    # Processed Context (from CapabilityContextAgent)
    # ─────────────────────────────────────────────────────────────────────────
    structured_context = db.Column(db.JSON)  # AI-processed context
    identified_needs = db.Column(db.JSON)  # Extracted client needs
    decision_criteria = db.Column(db.JSON)  # What matters for their decision
    
    # ─────────────────────────────────────────────────────────────────────────
    # Capability Alignment (from CapabilityAlignmentAgent)
    # ─────────────────────────────────────────────────────────────────────────
    # [{
    #   "client_need": "Modernize legacy systems",
    #   "vendor_strength": "Cloud migration expertise", 
    #   "proof_point": "CS-001",
    #   "alignment_score": 0.92,
    #   "talking_points": ["10 similar projects", "avg 40% cost reduction"]
    # }]
    alignment_mapping = db.Column(db.JSON)
    alignment_score = db.Column(db.Float)  # Overall alignment score 0-100
    
    # ─────────────────────────────────────────────────────────────────────────
    # Footprints (selected proof points)
    # ─────────────────────────────────────────────────────────────────────────
    # Selected case study IDs
    selected_case_studies = db.Column(db.JSON)  # [1, 2, 5]
    # Selected success story IDs
    selected_success_stories = db.Column(db.JSON)
    # Selected testimonial IDs
    selected_testimonials = db.Column(db.JSON)
    # Custom metrics to highlight
    highlight_metrics = db.Column(db.JSON)  # [{"metric": "...", "value": "..."}]
    
    # ─────────────────────────────────────────────────────────────────────────
    # Win-Win Value (from WinWinValueAgent)
    # ─────────────────────────────────────────────────────────────────────────
    client_value_props = db.Column(db.JSON)  # What client gains
    vendor_value_props = db.Column(db.JSON)  # What vendor gains
    partnership_narrative = db.Column(db.Text)  # Long-term vision narrative
    
    # ─────────────────────────────────────────────────────────────────────────
    # Generated Content
    # ─────────────────────────────────────────────────────────────────────────
    generated_sections = db.Column(db.JSON)  # Generated proposal sections
    generation_status = db.Column(db.String(30), default='pending')  # pending, in_progress, complete, error
    
    # ─────────────────────────────────────────────────────────────────────────
    # Metadata
    # ─────────────────────────────────────────────────────────────────────────
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Relationships
    project = db.relationship('Project', backref=db.backref('capability_context', uselist=False))
    
    def to_dict(self):
        """Serialize capability context for API responses."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            # Client info
            'client_product': self.client_product,
            'client_domain': self.client_domain,
            'client_challenges': self.client_challenges or [],
            'client_goals': self.client_goals or [],
            'meeting_notes': self.meeting_notes,
            'meeting_date': self.meeting_date.isoformat() if self.meeting_date else None,
            'key_stakeholders': self.key_stakeholders or [],
            # Processed context
            'structured_context': self.structured_context,
            'identified_needs': self.identified_needs or [],
            'decision_criteria': self.decision_criteria or [],
            # Alignment
            'alignment_mapping': self.alignment_mapping or [],
            'alignment_score': self.alignment_score,
            # Footprints
            'selected_case_studies': self.selected_case_studies or [],
            'selected_success_stories': self.selected_success_stories or [],
            'selected_testimonials': self.selected_testimonials or [],
            'highlight_metrics': self.highlight_metrics or [],
            # Win-Win
            'client_value_props': self.client_value_props or [],
            'vendor_value_props': self.vendor_value_props or [],
            'partnership_narrative': self.partnership_narrative,
            # Generated
            'generated_sections': self.generated_sections,
            'generation_status': self.generation_status,
            # Metadata
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @classmethod
    def get_or_create(cls, project_id: int):
        """Get existing context or create new one for project."""
        context = cls.query.filter_by(project_id=project_id).first()
        if not context:
            context = cls(project_id=project_id)
            db.session.add(context)
            db.session.commit()
        return context
    
    def update_client_info(self, data: dict):
        """Update client information fields."""
        if 'client_product' in data:
            self.client_product = data['client_product']
        if 'client_domain' in data:
            self.client_domain = data['client_domain']
        if 'client_challenges' in data:
            self.client_challenges = data['client_challenges']
        if 'client_goals' in data:
            self.client_goals = data['client_goals']
        if 'meeting_notes' in data:
            self.meeting_notes = data['meeting_notes']
        if 'meeting_date' in data:
            self.meeting_date = data['meeting_date']
        if 'key_stakeholders' in data:
            self.key_stakeholders = data['key_stakeholders']
        db.session.commit()
    
    def update_alignment(self, alignment_data: list, score: float = None):
        """Update capability alignment mapping."""
        self.alignment_mapping = alignment_data
        if score is not None:
            self.alignment_score = score
        db.session.commit()
    
    def update_footprints(self, case_studies: list = None, success_stories: list = None, 
                          testimonials: list = None, metrics: list = None):
        """Update selected footprints."""
        if case_studies is not None:
            self.selected_case_studies = case_studies
        if success_stories is not None:
            self.selected_success_stories = success_stories
        if testimonials is not None:
            self.selected_testimonials = testimonials
        if metrics is not None:
            self.highlight_metrics = metrics
        db.session.commit()
    
    def update_win_win(self, client_value: list, vendor_value: list, narrative: str = None):
        """Update win-win value propositions."""
        self.client_value_props = client_value
        self.vendor_value_props = vendor_value
        if narrative:
            self.partnership_narrative = narrative
        db.session.commit()


def get_capability_context_model():
    """Factory function for capability context model."""
    return CapabilityContext
