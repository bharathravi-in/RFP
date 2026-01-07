"""
Co-Pilot Chat Models

Database models for storing chat sessions and messages.
"""
from datetime import datetime
from app.extensions import db


class CoPilotSession(db.Model):
    """Chat session for a user."""
    __tablename__ = 'copilot_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), default='New Chat')
    mode = db.Column(db.String(20), default='general')  # 'general' or 'agents'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref=db.backref('copilot_sessions', lazy='dynamic'))
    messages = db.relationship('CoPilotMessage', backref='session', lazy='dynamic',
                               cascade='all, delete-orphan', order_by='CoPilotMessage.created_at')

    def to_dict(self, include_messages=False):
        data = {
            'id': self.id,
            'title': self.title,
            'mode': self.mode,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            data['messages'] = [m.to_dict() for m in self.messages.all()]
        return data


class CoPilotMessage(db.Model):
    """Individual message in a chat session."""
    __tablename__ = 'copilot_messages'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('copilot_sessions.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = db.Column(db.Text, nullable=False)
    agent_name = db.Column(db.String(100))
    agent_icon = db.Column(db.String(10))
    status = db.Column(db.String(20), default='complete')  # 'sending', 'streaming', 'complete', 'error'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'agentName': self.agent_name,
            'agentIcon': self.agent_icon,
            'status': self.status,
            'timestamp': self.created_at.isoformat() if self.created_at else None,
        }
