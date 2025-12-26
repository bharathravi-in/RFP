"""
Feedback Learning Model

Stores learned patterns from user edits to improve future AI responses.
"""
from datetime import datetime
from app.extensions import db


class FeedbackLearning(db.Model):
    """Stores learned patterns from user corrections of AI answers."""
    
    __tablename__ = 'feedback_learnings'
    
    id = db.Column(db.Integer, primary_key=True)
    org_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    
    # Learning details
    category = db.Column(db.String(50), nullable=True)  # Question category
    pattern = db.Column(db.Text, nullable=False)  # Learned pattern or preference
    applies_to = db.Column(db.String(50), default='all')  # Category or 'all'
    confidence = db.Column(db.Float, default=0.5)  # How confident in this learning
    learning_type = db.Column(db.String(50), nullable=False)  # content, terminology, tone
    
    # Source tracking
    question_id = db.Column(db.Integer, nullable=True)
    original_answer = db.Column(db.Text, nullable=True)
    edited_answer = db.Column(db.Text, nullable=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    usage_count = db.Column(db.Integer, default=0)  # How often this learning was used
    
    # Relationship
    organization = db.relationship('Organization', backref=db.backref('feedback_learnings', lazy='dynamic'))
    
    def __repr__(self):
        return f'<FeedbackLearning {self.id}: {self.learning_type} for {self.category}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'pattern': self.pattern,
            'applies_to': self.applies_to,
            'confidence': self.confidence,
            'learning_type': self.learning_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'usage_count': self.usage_count
        }
