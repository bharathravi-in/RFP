"""
Document Chat Models

Database models for document-specific chat with summary and message history.
"""
from datetime import datetime
from app.extensions import db


class DocumentChatSession(db.Model):
    """Chat session linked to a specific document."""
    __tablename__ = 'document_chat_sessions'

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # AI-generated content
    summary = db.Column(db.Text, nullable=True)  # Document summary (Overview + Key Points)
    key_points = db.Column(db.JSON, nullable=True)  # List of key points
    suggestions = db.Column(db.JSON, nullable=True)  # Suggested questions
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    document = db.relationship('Document', backref=db.backref('chat_sessions', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('document_chats', lazy='dynamic'))
    messages = db.relationship('DocumentChatMessage', backref='session', lazy='dynamic',
                               cascade='all, delete-orphan', order_by='DocumentChatMessage.created_at')

    def to_dict(self, include_messages=False):
        data = {
            'id': self.id,
            'documentId': self.document_id,
            'summary': self.summary,
            'keyPoints': self.key_points or [],
            'suggestions': self.suggestions or [],
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            data['messages'] = [m.to_dict() for m in self.messages.all()]
        return data


class DocumentChatMessage(db.Model):
    """Individual message in a document chat session."""
    __tablename__ = 'document_chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('document_chat_sessions.id'), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = db.Column(db.Text, nullable=False)
    
    # For highlighting/citation
    document_references = db.Column(db.JSON, nullable=True)  # Page numbers, sections referenced
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'documentReferences': self.document_references,
            'timestamp': self.created_at.isoformat() if self.created_at else None,
        }
