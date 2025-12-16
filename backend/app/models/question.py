from datetime import datetime
from ..extensions import db


class Question(db.Model):
    """Question model for extracted RFP questions."""
    __tablename__ = 'questions'
    
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    section = db.Column(db.String(255), nullable=True)  # Section/category in document
    category = db.Column(db.String(100), nullable=True)  # security, compliance, technical, pricing, legal, product
    sub_category = db.Column(db.String(100), nullable=True)  # More specific: encryption, gdpr, api, etc.
    priority = db.Column(db.String(20), default='normal')  # high, normal, low
    flags = db.Column(db.JSON, default=list)  # List of flags: sensitive, legal_review, low_confidence, etc.
    order = db.Column(db.Integer, default=0)  # Display order
    status = db.Column(db.String(50), default='pending')  # pending, answered, review, approved, rejected
    original_text = db.Column(db.Text, nullable=True)  # Before any edits
    notes = db.Column(db.Text, nullable=True)  # Internal notes
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', back_populates='questions')
    document = db.relationship('Document', back_populates='questions')
    answers = db.relationship('Answer', back_populates='question', cascade='all, delete-orphan', order_by='Answer.version.desc()')
    
    @property
    def current_answer(self):
        """Get the latest answer version."""
        return self.answers[0] if self.answers else None
    
    def to_dict(self, include_answer=False):
        """Serialize question to dictionary."""
        data = {
            'id': self.id,
            'text': self.text,
            'section': self.section,
            'category': self.category,
            'sub_category': self.sub_category,
            'priority': self.priority,
            'flags': self.flags or [],
            'order': self.order,
            'status': self.status,
            'notes': self.notes,
            'project_id': self.project_id,
            'document_id': self.document_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_answer and self.current_answer:
            data['answer'] = self.current_answer.to_dict()
        
        return data
