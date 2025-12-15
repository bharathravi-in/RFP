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
            'organization_id': self.organization_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_stats:
            data['document_count'] = len(self.documents) if self.documents else 0
            data['question_count'] = len(self.questions) if self.questions else 0
            data['reviewer_ids'] = [r.id for r in self.reviewers] if self.reviewers else []
        
        return data
