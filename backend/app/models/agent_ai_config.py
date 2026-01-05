"""
Agent AI Configuration Model

Stores AI provider settings per agent type per organization.
"""
from datetime import datetime
from ..extensions import db
from cryptography.fernet import Fernet
import os


class AgentAIConfig(db.Model):
    """AI provider configuration for specific agents."""
    __tablename__ = 'agent_ai_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    
    # Agent identification
    agent_type = db.Column(db.String(50), nullable=False)  # 'default', 'rfp_analysis', 'ppt_generation', etc.
    
    # Provider configuration
    provider = db.Column(db.String(50), nullable=False)  # google, openai, azure, litellm, custom
    model = db.Column(db.String(200), nullable=False)    # FREE TEXT - any model name
    api_key = db.Column(db.Text, nullable=True)          # Encrypted, optional if using default
    api_endpoint = db.Column(db.String(255), nullable=True)  # For Azure/custom endpoints
    
    # LiteLLM specific configuration
    base_url = db.Column(db.String(500), nullable=True)  # LiteLLM proxy URL
    temperature = db.Column(db.Float, default=0.7)       # Generation temperature
    max_tokens = db.Column(db.Integer, default=4096)     # Max tokens to generate
    
    # Key management
    use_default_key = db.Column(db.Boolean, default=True)  # Use organization's default API key
    
    # Additional settings
    config_metadata = db.Column(db.JSON, default=dict)  # Provider-specific settings
    
    # Resilience settings
    timeout_seconds = db.Column(db.Integer, default=60)  # Request timeout
    max_retries = db.Column(db.Integer, default=3)       # Retry attempts on failure
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref='agent_configs')
    
    # Unique constraint: one active config per agent type per org
    __table_args__ = (
        db.UniqueConstraint('organization_id', 'agent_type', 'is_active', 
                           name='uq_org_agent_active'),
    )
    
    def _get_cipher(self):
        """Get Fernet cipher for encryption/decryption."""
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY not set in environment")
        return Fernet(encryption_key.encode())
    
    def encrypt_key(self, key: str) -> str:
        """Encrypt API key."""
        if not key:
            return None
        cipher = self._get_cipher()
        return cipher.encrypt(key.encode()).decode()
    
    def decrypt_key(self, encrypted_key: str) -> str:
        """Decrypt API key."""
        if not encrypted_key:
            return None
        cipher = self._get_cipher()
        return cipher.decrypt(encrypted_key.encode()).decode()
    
    def set_api_key(self, key: str):
        """Set encrypted API key."""
        self.api_key = self.encrypt_key(key) if key else None
    
    def get_api_key(self) -> str:
        """Get decrypted API key."""
        if self.use_default_key:
            # Get default key from organization's default config
            default_config = AgentAIConfig.query.filter_by(
                organization_id=self.organization_id,
                agent_type='default',
                is_active=True
            ).first()
            if default_config and default_config.api_key:
                return default_config.decrypt_key(default_config.api_key)
            return None
        
        return self.decrypt_key(self.api_key) if self.api_key else None
    
    def to_dict(self, include_key=False):
        """Serialize to dictionary."""
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'agent_type': self.agent_type,
            'provider': self.provider,
            'model': self.model,
            'api_endpoint': self.api_endpoint,
            'base_url': self.base_url,
            'temperature': self.temperature,
            'max_tokens': self.max_tokens,
            'use_default_key': self.use_default_key,
            'config_metadata': self.config_metadata,
            'timeout_seconds': self.timeout_seconds,
            'max_retries': self.max_retries,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Only include API key if explicitly requested
        if include_key:
            data['api_key'] = self.get_api_key()
        
        return data
