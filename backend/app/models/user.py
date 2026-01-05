from datetime import datetime
from ..extensions import db
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    """User model with tenant-scoped role-based access control.
    
    Tenant Roles:
    - owner: Billing, users, settings, full control
    - admin: Manage users, agents, configurations
    - editor: Create/edit proposals, documents
    - reviewer: Can review and approve answers
    - viewer: Read-only access
    
    Platform Role:
    - is_super_admin: Can manage all organizations' features and subscriptions
    """
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    profile_photo = db.Column(db.Text, nullable=True)
    role = db.Column(db.String(50), nullable=False, default='viewer')  # owner, admin, editor, reviewer, viewer
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    expertise_tags = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Platform-level super admin (can manage all organizations)
    is_super_admin = db.Column(db.Boolean, default=False)
    
    # Relationships
    organization = db.relationship('Organization', back_populates='users')
    projects = db.relationship('Project', back_populates='created_by_user', foreign_keys='Project.created_by')
    reviews = db.relationship('Answer', back_populates='reviewer', foreign_keys='Answer.reviewed_by')
    
    def set_password(self, password):
        """Hash and set the user password."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if provided password matches hash."""
        return check_password_hash(self.password_hash, password)
    
    def is_owner(self) -> bool:
        """Check if user is the tenant owner."""
        return self.role == 'owner'
    
    def can_manage_billing(self) -> bool:
        """Only owners can manage billing."""
        return self.role == 'owner'
    
    def can_manage_users(self) -> bool:
        """Owners and admins can manage users."""
        return self.role in ['owner', 'admin']
    
    def can_edit_content(self) -> bool:
        """Owners, admins, and editors can edit content."""
        return self.role in ['owner', 'admin', 'editor']
    
    def to_dict(self):
        """Serialize user to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'profile_photo': self.profile_photo,
            'role': self.role,
            'organization_id': self.organization_id,
            'is_active': self.is_active,
            'expertise_tags': self.expertise_tags or [],
            'is_super_admin': self.is_super_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

