"""
Notification model for user notifications (mentions, assignments, etc.)
"""
from datetime import datetime
from ..extensions import db


class Notification(db.Model):
    """User notification model."""
    
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Who receives the notification
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Who triggered it (nullable for system notifications)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Notification type
    type = db.Column(db.String(50), nullable=False)  # mention, assignment, comment, approval, etc.
    
    # What it relates to
    entity_type = db.Column(db.String(50))  # section, question, project, etc.
    entity_id = db.Column(db.Integer)
    
    # Content
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text)
    
    # URL to navigate to (optional)
    link = db.Column(db.String(500))
    
    # Status
    read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('notifications', lazy='dynamic'))
    actor = db.relationship('User', foreign_keys=[actor_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'actor_id': self.actor_id,
            'actor_name': self.actor.name if self.actor else None,
            'type': self.type,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'title': self.title,
            'message': self.message,
            'link': self.link,
            'read': self.read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    @classmethod
    def create_mention_notification(cls, user_id: int, actor_id: int, entity_type: str, entity_id: int, link: str = None):
        """Create a mention notification."""
        from ..models import User
        actor = User.query.get(actor_id)
        actor_name = actor.name if actor else 'Someone'
        
        return cls(
            user_id=user_id,
            actor_id=actor_id,
            type='mention',
            entity_type=entity_type,
            entity_id=entity_id,
            title=f'{actor_name} mentioned you',
            message=f'{actor_name} mentioned you in a {entity_type} comment',
            link=link
        )
    
    @classmethod
    def create_assignment_notification(cls, user_id: int, actor_id: int, project_name: str, section_title: str, link: str = None):
        """Create an assignment notification."""
        from ..models import User
        actor = User.query.get(actor_id)
        actor_name = actor.name if actor else 'Someone'
        
        return cls(
            user_id=user_id,
            actor_id=actor_id,
            type='assignment',
            entity_type='section',
            title=f'New section assigned',
            message=f'{actor_name} assigned you to "{section_title}" in {project_name}',
            link=link
        )
