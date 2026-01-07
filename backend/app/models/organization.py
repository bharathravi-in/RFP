from datetime import datetime, timedelta
from ..extensions import db


class Organization(db.Model):
    """Organization model for multi-tenancy."""
    __tablename__ = 'organizations'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), unique=True, nullable=False, index=True)
    settings = db.Column(db.JSON, default=dict)  # AI preferences, integrations config
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Trial & Subscription
    trial_ends_at = db.Column(db.DateTime, nullable=True)  # When trial expires
    subscription_plan = db.Column(db.String(50), default='trial')  # trial, starter, professional, enterprise
    subscription_status = db.Column(db.String(50), default='trialing')  # trialing, active, canceled, expired
    
    # Plan Limits
    max_users = db.Column(db.Integer, default=5)  # Max users allowed
    max_projects = db.Column(db.Integer, default=10)  # Max projects allowed
    max_documents = db.Column(db.Integer, default=50)  # Max documents allowed
    
    # Feature Flags (for plan-based feature gating)
    feature_flags = db.Column(db.JSON, default=dict)  # { 'ai_chat': true, 'webhooks': false }
    
    # Relationships
    users = db.relationship('User', back_populates='organization')
    projects = db.relationship('Project', back_populates='organization')
    knowledge_items = db.relationship('KnowledgeItem', back_populates='organization')
    ai_configs = db.relationship('OrganizationAIConfig', back_populates='organization', cascade='all, delete-orphan')
    
    @property
    def is_trial_active(self) -> bool:
        """Check if trial is still active."""
        if self.subscription_plan != 'trial':
            return False
        if not self.trial_ends_at:
            return True  # No end date = unlimited trial (legacy)
        return datetime.utcnow() < self.trial_ends_at
    
    @property
    def trial_days_remaining(self) -> int:
        """Get remaining trial days."""
        if not self.trial_ends_at:
            return 14  # Default
        remaining = (self.trial_ends_at - datetime.utcnow()).days
        return max(0, remaining)
    
    @property
    def is_subscription_active(self) -> bool:
        """Check if subscription is active (including trial)."""
        return self.subscription_status in ['trialing', 'active']
    
    def has_feature(self, feature: str) -> bool:
        """Check if organization has access to a feature."""
        # Enterprise has all features
        if self.subscription_plan == 'enterprise':
            return True
        # Check feature flags
        return self.feature_flags.get(feature, False)
    
    def start_trial(self, days: int = 14):
        """Start or reset trial period."""
        self.subscription_plan = 'trial'
        self.subscription_status = 'trialing'
        self.trial_ends_at = datetime.utcnow() + timedelta(days=days)
    
    def to_dict(self):
        """Serialize organization to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'settings': self.settings,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_count': len(self.users) if self.users else 0,
            'project_count': len(self.projects) if self.projects else 0,
            # Trial & Subscription
            'trial_ends_at': self.trial_ends_at.isoformat() if self.trial_ends_at else None,
            'trial_days_remaining': self.trial_days_remaining,
            'is_trial_active': self.is_trial_active,
            'subscription_plan': self.subscription_plan,
            'subscription_status': self.subscription_status,
            'is_subscription_active': self.is_subscription_active,
            # Limits
            'max_users': self.max_users,
            'max_projects': self.max_projects,
            'max_documents': self.max_documents,
            'feature_flags': self.feature_flags or {},
        }
