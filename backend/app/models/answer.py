from datetime import datetime
from ..extensions import db


class Answer(db.Model):
    """Answer model for AI-generated and human-reviewed responses."""
    __tablename__ = 'answers'
    
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    confidence_score = db.Column(db.Float, default=0.0)  # 0.0 to 1.0
    sources = db.Column(db.JSON, default=list)  # Array of source citations
    status = db.Column(db.String(50), default='draft')  # draft, pending_review, approved, rejected
    version = db.Column(db.Integer, default=1)
    is_ai_generated = db.Column(db.Boolean, default=True)
    generation_params = db.Column(db.JSON, default=dict)  # Model, temperature, etc.
    review_notes = db.Column(db.Text, nullable=True)  # Reviewer comments
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    question = db.relationship('Question', back_populates='answers')
    reviewer = db.relationship('User', back_populates='reviews', foreign_keys=[reviewed_by])
    comments = db.relationship('AnswerComment', back_populates='answer', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Serialize answer to dictionary."""
        return {
            'id': self.id,
            'content': self.content,
            'confidence_score': self.confidence_score,
            'sources': self.sources,
            'status': self.status,
            'version': self.version,
            'is_ai_generated': self.is_ai_generated,
            'review_notes': self.review_notes,
            'question_id': self.question_id,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'comments': [c.to_dict() for c in self.comments] if self.comments else []
        }


class AnswerComment(db.Model):
    """Inline comments on answers for collaboration."""
    __tablename__ = 'answer_comments'
    
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    position = db.Column(db.JSON, nullable=True)  # Selection range in editor
    resolved = db.Column(db.Boolean, default=False)
    answer_id = db.Column(db.Integer, db.ForeignKey('answers.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    answer = db.relationship('Answer', back_populates='comments')
    user = db.relationship('User')
    
    def to_dict(self):
        """Serialize comment to dictionary."""
        return {
            'id': self.id,
            'content': self.content,
            'position': self.position,
            'resolved': self.resolved,
            'answer_id': self.answer_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
