"""Invitation model for team member invitations."""
from datetime import datetime, timedelta
import secrets
from app import db


class Invitation(db.Model):
    """Model for organization invitations."""
    __tablename__ = 'invitations'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    role = db.Column(db.String(20), default='viewer')  # admin, editor, reviewer, viewer
    status = db.Column(db.String(20), default='pending')  # pending, accepted, cancelled, expired
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    invited_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    accepted_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    organization = db.relationship('Organization', backref=db.backref('invitations', lazy='dynamic'))
    inviter = db.relationship('User', backref=db.backref('sent_invitations', lazy='dynamic'))

    def __init__(self, email, organization_id, invited_by, role='viewer', expires_days=7):
        self.email = email.lower()
        self.organization_id = organization_id
        self.invited_by = invited_by
        self.role = role
        self.token = secrets.token_urlsafe(32)
        self.expires_at = datetime.utcnow() + timedelta(days=expires_days)

    @property
    def is_expired(self):
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self):
        return self.status == 'pending' and not self.is_expired

    def accept(self):
        self.status = 'accepted'
        self.accepted_at = datetime.utcnow()

    def cancel(self):
        self.status = 'cancelled'

    def regenerate_token(self, expires_days=7):
        """Generate a new token and extend expiration."""
        self.token = secrets.token_urlsafe(32)
        self.expires_at = datetime.utcnow() + timedelta(days=expires_days)
        self.status = 'pending'

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'status': self.status,
            'organization_id': self.organization_id,
            'invited_by': self.invited_by,
            'inviter_name': self.inviter.name if self.inviter else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_expired': self.is_expired,
            'is_valid': self.is_valid,
        }
