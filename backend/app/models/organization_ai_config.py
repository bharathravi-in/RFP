"""
Organization AI Configuration Model

Stores AI provider settings (embedding and LLM) per organization.
"""
from datetime import datetime
from ..extensions import db
from cryptography.fernet import Fernet
import os


class OrganizationAIConfig(db.Model):
    """AI provider configuration for organizations."""
    __tablename__ = 'organization_ai_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    
    # Embedding provider configuration
    embedding_provider = db.Column(db.String(50), default='google')  # google, openai, azure, cohere
    embedding_model = db.Column(db.String(100), nullable=True)
    embedding_api_key = db.Column(db.Text, nullable=True)  # Encrypted
    embedding_api_endpoint = db.Column(db.String(255), nullable=True)  # For Azure/custom endpoints
    embedding_dimension = db.Column(db.Integer, default=768)
    
    # LLM provider configuration (for answer generation)
    llm_provider = db.Column(db.String(50), default='google')  # google, openai, azure, litellm
    llm_model = db.Column(db.String(100), nullable=True)
    llm_api_key = db.Column(db.Text, nullable=True)  # Encrypted
    llm_api_endpoint = db.Column(db.String(255), nullable=True)
    
    # LiteLLM proxy configuration (organization defaults)
    litellm_base_url = db.Column(db.String(500), nullable=True)  # Default: https://litellm.tarento.dev
    litellm_api_key = db.Column(db.Text, nullable=True)  # Encrypted
    
    # Additional provider-specific settings
    config_metadata = db.Column(db.JSON, default=dict)
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', back_populates='ai_configs')
    
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
    
    def set_embedding_key(self, key: str):
        """Set encrypted embedding API key."""
        self.embedding_api_key = self.encrypt_key(key) if key else None
    
    def get_embedding_key(self) -> str:
        """Get decrypted embedding API key."""
        return self.decrypt_key(self.embedding_api_key) if self.embedding_api_key else None
    
    def set_llm_key(self, key: str):
        """Set encrypted LLM API key."""
        self.llm_api_key = self.encrypt_key(key) if key else None
    
    def get_llm_key(self) -> str:
        """Get decrypted LLM API key."""
        return self.decrypt_key(self.llm_api_key) if self.llm_api_key else None
    
    def set_litellm_key(self, key: str):
        """Set encrypted LiteLLM API key."""
        self.litellm_api_key = self.encrypt_key(key) if key else None
    
    def get_litellm_key(self) -> str:
        """Get decrypted LiteLLM API key."""
        return self.decrypt_key(self.litellm_api_key) if self.litellm_api_key else None
    
    def to_dict(self, include_keys=False):
        """Serialize to dictionary."""
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'embedding_provider': self.embedding_provider,
            'embedding_model': self.embedding_model,
            'embedding_api_endpoint': self.embedding_api_endpoint,
            'embedding_dimension': self.embedding_dimension,
            'llm_provider': self.llm_provider,
            'llm_model': self.llm_model,
            'llm_api_endpoint': self.llm_api_endpoint,
            'litellm_base_url': self.litellm_base_url,
            'config_metadata': self.config_metadata,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Only include API keys if explicitly requested (for admin use)
        if include_keys:
            data['embedding_api_key'] = self.get_embedding_key()
            data['llm_api_key'] = self.get_llm_key()
            data['litellm_api_key'] = self.get_litellm_key()
        
        return data
