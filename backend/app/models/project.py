from datetime import datetime
from ..extensions import db


# Association table for project reviewers
project_reviewers = db.Table(
    'project_reviewers',
    db.Column('project_id', db.Integer, db.ForeignKey('projects.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True)
)


class Project(db.Model):
    """Project model representing an RFP/RFI/questionnaire."""
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default='draft')  # draft, in_progress, review, completed
    completion_percent = db.Column(db.Float, default=0.0)
    due_date = db.Column(db.DateTime, nullable=True)
    
    # Multi-dimensional filtering fields for knowledge base selection
    client_type = db.Column(db.String(50), nullable=True)  # government, private, ngo
    geography = db.Column(db.String(50), nullable=True)  # Region code (US, EU, APAC)
    currency = db.Column(db.String(10), nullable=True)  # Currency code (USD, EUR)
    industry = db.Column(db.String(100), nullable=True)  # Industry sector
    compliance_requirements = db.Column(db.JSON, default=list)  # ["SOC2", "GDPR"]
    language = db.Column(db.String(10), default='en')  # Primary language
    
    # Project metadata
    client_name = db.Column(db.String(255), nullable=True)  # Name of the client
    project_value = db.Column(db.Float, nullable=True)  # Project/contract value
    
    # Go/No-Go Analysis fields
    go_no_go_status = db.Column(db.String(20), default='pending')  # pending, go, no_go
    go_no_go_score = db.Column(db.Float, nullable=True)  # 0-100 win probability
    go_no_go_analysis = db.Column(db.JSON, default=dict)  # Full breakdown and AI recommendation
    go_no_go_completed_at = db.Column(db.DateTime, nullable=True)
    
    # Project Outcome Tracking (for analytics)
    outcome = db.Column(db.String(20), default='pending')  # pending, won, lost, abandoned
    outcome_date = db.Column(db.DateTime, nullable=True)  # When outcome was recorded
    outcome_notes = db.Column(db.Text, nullable=True)  # Additional notes about outcome
    contract_value = db.Column(db.Float, nullable=True)  # Actual contract value if won
    loss_reason = db.Column(db.String(100), nullable=True)  # Reason for loss (price, features, timing, other)
    
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', back_populates='projects')
    created_by_user = db.relationship('User', back_populates='projects', foreign_keys=[created_by])
    reviewers = db.relationship('User', secondary=project_reviewers, backref='assigned_projects')
    documents = db.relationship('Document', back_populates='project', cascade='all, delete-orphan')
    questions = db.relationship('Question', back_populates='project', cascade='all, delete-orphan')
    
    # Many-to-many relationship with knowledge profiles
    from .knowledge_profile import project_knowledge_profiles
    knowledge_profiles = db.relationship(
        'KnowledgeProfile',
        secondary=project_knowledge_profiles,
        backref=db.backref('projects', lazy='dynamic')
    )
    
    def calculate_completion(self):
        """Calculate project completion percentage based on answered questions."""
        if not self.questions:
            return 0.0
        answered = sum(1 for q in self.questions if q.status in ['answered', 'approved'])
        return (answered / len(self.questions)) * 100
    
    def to_dict(self, include_stats=False):
        """Serialize project to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'completion_percent': self.completion_percent,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            # Multi-dimensional fields
            'client_type': self.client_type,
            'geography': self.geography,
            'currency': self.currency,
            'industry': self.industry,
            'compliance_requirements': self.compliance_requirements or [],
            'language': self.language,
            'client_name': self.client_name,
            'project_value': self.project_value,
            # Go/No-Go Analysis
            'go_no_go_status': self.go_no_go_status,
            'go_no_go_score': self.go_no_go_score,
            'go_no_go_analysis': self.go_no_go_analysis or {},
            'go_no_go_completed_at': self.go_no_go_completed_at.isoformat() if self.go_no_go_completed_at else None,
            # Project Outcome
            'outcome': self.outcome,
            'outcome_date': self.outcome_date.isoformat() if self.outcome_date else None,
            'outcome_notes': self.outcome_notes,
            'contract_value': self.contract_value,
            'loss_reason': self.loss_reason,
            # Knowledge profiles
            'knowledge_profile_ids': [p.id for p in self.knowledge_profiles] if self.knowledge_profiles else [],
            'organization_id': self.organization_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_stats:
            data['document_count'] = len(self.documents) if self.documents else 0
            
            # Prioritize RFP sections (current content model) over legacy questions
            sections_list = list(self.sections) if hasattr(self, 'sections') else []
            questions = self.questions or []
            
            if sections_list:
                # RFP sections-based counting (primary content model)
                data['question_count'] = len(sections_list)
                # Sections with content = answered
                data['answered_count'] = sum(1 for s in sections_list if s.content)
                # Sections with status 'approved' or 'reviewed' = approved
                data['approved_count'] = sum(1 for s in sections_list if s.status in ['approved', 'reviewed'])
            elif questions:
                # Legacy questions-based counting (fallback)
                data['question_count'] = len(questions)
                data['answered_count'] = sum(1 for q in questions if q.status in ['answered', 'approved'])
                data['approved_count'] = sum(1 for q in questions if q.status == 'approved')
            else:
                data['question_count'] = 0
                data['answered_count'] = 0
                data['approved_count'] = 0
            
            data['reviewer_ids'] = [r.id for r in self.reviewers] if self.reviewers else []
            data['knowledge_profiles'] = [p.to_dict() for p in self.knowledge_profiles] if self.knowledge_profiles else []
            
            # Update completion_percent dynamically
            if data['question_count'] > 0:
                data['completion_percent'] = (data['answered_count'] / data['question_count']) * 100
        
        return data
