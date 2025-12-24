"""Comment model for inline comments and @mentions."""
from datetime import datetime
from ..extensions import db


class Comment(db.Model):
    """
    Stores inline comments on sections, questions, or answers.
    Supports threaded replies and @mentions.
    """
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    
    # Target (only one should be set)
    section_id = db.Column(db.Integer, db.ForeignKey('rfp_sections.id'), nullable=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answers.id'), nullable=True)
    
    # Threading
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    
    # Content
    content = db.Column(db.Text, nullable=False)
    mentioned_users = db.Column(db.JSON, default=list)  # List of user IDs mentioned
    
    # Status
    resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    
    # Metadata
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref='org_comments')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_comments')
    resolver = db.relationship('User', foreign_keys=[resolved_by])
    parent = db.relationship('Comment', remote_side=[id], backref='replies')
    section = db.relationship('RFPSection', backref='section_comments')
    question = db.relationship('Question', backref='question_comments')
    answer = db.relationship('Answer', backref='answer_comments')
    
    def to_dict(self, include_replies=True):
        """Serialize to dictionary."""
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'section_id': self.section_id,
            'question_id': self.question_id,
            'answer_id': self.answer_id,
            'parent_id': self.parent_id,
            'content': self.content,
            'mentioned_users': self.mentioned_users or [],
            'resolved': self.resolved,
            'resolved_by': self.resolved_by,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'created_by': self.created_by,
            'creator_name': self.creator.name if self.creator else None,
            'creator_avatar': self.creator.profile_photo if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_replies and self.replies:
            data['replies'] = [r.to_dict(include_replies=False) for r in self.replies]
        else:
            data['reply_count'] = len(self.replies) if self.replies else 0
        
        return data
    
    @property
    def target_type(self):
        """Get the type of target this comment is on."""
        if self.section_id:
            return 'section'
        elif self.question_id:
            return 'question'
        elif self.answer_id:
            return 'answer'
        return None
    
    @property
    def target_id(self):
        """Get the ID of the target."""
        return self.section_id or self.question_id or self.answer_id
