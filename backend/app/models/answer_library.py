"""Answer Library model for reusable Q&A repository."""
from datetime import datetime
from ..extensions import db


class AnswerLibraryItem(db.Model):
    """
    Stores approved answers in a reusable library.
    Can be searched and suggested when answering similar questions.
    """
    __tablename__ = 'answer_library_items'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    
    # Q&A content
    question_text = db.Column(db.Text, nullable=False)  # The question this answers
    answer_text = db.Column(db.Text, nullable=False)    # The approved answer
    
    # Categorization
    category = db.Column(db.String(100), nullable=True)   # security, technical, pricing, etc.
    tags = db.Column(db.JSON, default=list)               # Additional tags for search
    
    # Workflow & Versioning
    status = db.Column(db.String(50), default='approved')  # draft, under_review, approved, archived
    version_number = db.Column(db.Integer, default=1)
    item_metadata = db.Column(db.JSON, default=dict)       # Flexible metadata for additional info
    
    # Review management
    last_reviewed_at = db.Column(db.DateTime, nullable=True)
    next_review_due = db.Column(db.DateTime, nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Source tracking
    source_project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    source_question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=True)
    source_answer_id = db.Column(db.Integer, db.ForeignKey('answers.id'), nullable=True)
    
    # Usage metrics
    times_used = db.Column(db.Integer, default=0)
    times_helpful = db.Column(db.Integer, default=0)  # Positive feedback count
    
    # Metadata
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref='library_items')
    creator = db.relationship('User', foreign_keys=[created_by])
    updater = db.relationship('User', foreign_keys=[updated_by])
    reviewer_user = db.relationship('User', foreign_keys=[reviewed_by])
    source_project = db.relationship('Project', backref='library_items')
    
    def to_dict(self):
        """Serialize to dictionary."""
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'question_text': self.question_text,
            'answer_text': self.answer_text,
            'category': self.category,
            'tags': self.tags or [],
            'status': self.status,
            'version_number': self.version_number,
            'item_metadata': self.item_metadata or {},
            'last_reviewed_at': self.last_reviewed_at.isoformat() if self.last_reviewed_at else None,
            'next_review_due': self.next_review_due.isoformat() if self.next_review_due else None,
            'reviewed_by': self.reviewed_by,
            'reviewed_by_name': self.reviewer_user.name if self.reviewer_user else None,
            'source_project_id': self.source_project_id,
            'source_project_name': self.source_project.name if self.source_project else None,
            'source_question_id': self.source_question_id,
            'source_answer_id': self.source_answer_id,
            'times_used': self.times_used,
            'times_helpful': self.times_helpful,
            'created_by': self.created_by,
            'creator_name': self.creator.name if self.creator else None,
            'updated_by': self.updated_by,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @property
    def usage_score(self):
        """Calculate a usage/helpfulness score."""
        if self.times_used == 0:
            return 0
        return self.times_helpful / self.times_used
