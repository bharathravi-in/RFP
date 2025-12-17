from datetime import datetime
from ..extensions import db


class AnswerEdit(db.Model):
    """Track user edits to AI-generated answers for feedback loop."""
    __tablename__ = 'answer_edits'
    
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answers.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Edit content
    original_content = db.Column(db.Text, nullable=False)
    edited_content = db.Column(db.Text, nullable=False)
    edit_distance = db.Column(db.Integer, nullable=True)  # Levenshtein distance
    
    # Classification
    edit_type = db.Column(db.String(50), nullable=True)  # minor_fix, major_rewrite, tone_adjustment, factual_correction
    category = db.Column(db.String(100), nullable=True)  # Question category from Answer
    
    # Confidence tracking
    confidence_before = db.Column(db.Float, nullable=True)
    confidence_after = db.Column(db.Float, nullable=True)  # User-provided if desired
    
    # Metadata
    agent_name = db.Column(db.String(100), nullable=True)  # Which agent generated the original
    question_category = db.Column(db.String(100), nullable=True)  # security, technical, etc.
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    answer = db.relationship('Answer', backref=db.backref('edits', cascade='all, delete-orphan'))
    user = db.relationship('User')
    
    def to_dict(self):
        """Serialize to dictionary."""
        return {
            'id': self.id,
            'answer_id': self.answer_id,
            'user_id': self.user_id,
            'original_content': self.original_content,
            'edited_content': self.edited_content,
            'edit_distance': self.edit_distance,
            'edit_type': self.edit_type,
            'category': self.category,
            'confidence_before': self.confidence_before,
            'confidence_after': self.confidence_after,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AnswerFeedback(db.Model):
    """Track quality feedback and ratings on answers."""
    __tablename__ = 'answer_feedback'
    
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answers.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Feedback
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    feedback_type = db.Column(db.String(50), nullable=True)  # helpful, needs_work, incorrect, excellent
    comment = db.Column(db.Text, nullable=True)
    
    # Context
    question_category = db.Column(db.String(100), nullable=True)
    agent_name = db.Column(db.String(100), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    answer = db.relationship('Answer', backref=db.backref('feedback_items', cascade='all, delete-orphan'))
    user = db.relationship('User')
    
    # Constraints
    __table_args__ = (
        db.CheckConstraint('rating >= 1 AND rating <= 5', name='rating_range_check'),
    )
    
    def to_dict(self):
        """Serialize to dictionary."""
        return {
            'id': self.id,
            'answer_id': self.answer_id,
            'user_id': self.user_id,
            'rating': self.rating,
            'feedback_type': self.feedback_type,
            'comment': self.comment,
            'question_category': self.question_category,
            'agent_name': self.agent_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AgentPerformance(db.Model):
    """Track agent execution metrics for performance monitoring."""
    __tablename__ = 'agent_performance'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    
    # Agent details
    agent_name = db.Column(db.String(100), nullable=False)  # DocumentAnalyzer, QuestionExtractor, etc.
    step_name = db.Column(db.String(100), nullable=True)  # workflow step identifier
    
    # Performance
    execution_time_ms = db.Column(db.Integer, nullable=True)
    success = db.Column(db.Boolean, default=True)
    error_message = db.Column(db.Text, nullable=True)
    
    # Additional context
    context_data = db.Column(db.JSON, default=dict)  # question_count, retry_count, model_used, etc.
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref='agent_performance_logs')
    
    def to_dict(self):
        """Serialize to dictionary."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'agent_name': self.agent_name,
            'step_name': self.step_name,
            'execution_time_ms': self.execution_time_ms,
            'success': self.success,
            'error_message': self.error_message,
            'context_data': self.context_data,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
