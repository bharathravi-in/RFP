"""
SSO/SAML Configuration Models for enterprise authentication.

Supports SAML 2.0 and OIDC integrations for single sign-on.
"""
from datetime import datetime
from ..extensions import db
import json


class SSOConfiguration(db.Model):
    """SSO/SAML configuration for an organization."""
    
    __tablename__ = 'sso_configurations'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), 
                               nullable=False, unique=True)
    
    # SSO Type
    sso_type = db.Column(db.String(20), nullable=False)  # saml, oidc, azure_ad, okta, google
    
    # Status
    is_enabled = db.Column(db.Boolean, default=False)
    enforce_sso = db.Column(db.Boolean, default=False)  # Require SSO, disable password login
    
    # SAML Configuration
    saml_entity_id = db.Column(db.String(500))  # IdP Entity ID
    saml_sso_url = db.Column(db.String(500))  # IdP SSO URL
    saml_slo_url = db.Column(db.String(500))  # IdP Single Logout URL (optional)
    saml_certificate = db.Column(db.Text)  # IdP X.509 Certificate
    saml_signature_algorithm = db.Column(db.String(50), default='RSA_SHA256')
    saml_name_id_format = db.Column(db.String(100), default='urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress')
    
    # OIDC Configuration
    oidc_client_id = db.Column(db.String(200))
    oidc_client_secret = db.Column(db.String(500))  # Encrypted
    oidc_issuer_url = db.Column(db.String(500))  # e.g., https://accounts.google.com
    oidc_authorization_url = db.Column(db.String(500))
    oidc_token_url = db.Column(db.String(500))
    oidc_userinfo_url = db.Column(db.String(500))
    oidc_scopes = db.Column(db.String(200), default='openid profile email')
    
    # Attribute mapping (IdP attributes to local user fields)
    attribute_mapping = db.Column(db.JSON, default=lambda: {
        'email': 'email',
        'first_name': 'firstName',
        'last_name': 'lastName',
        'name': 'displayName',
        'groups': 'groups',
        'role': 'role'
    })
    
    # Role mapping (IdP groups/roles to local roles)
    role_mapping = db.Column(db.JSON, default=lambda: {
        'Admins': 'admin',
        'Managers': 'manager',
        'Users': 'member'
    })
    
    # Auto-provisioning
    auto_provision_users = db.Column(db.Boolean, default=True)
    default_role = db.Column(db.String(50), default='member')
    allowed_domains = db.Column(db.JSON, default=list)  # Restrict to specific email domains
    
    # SP (Service Provider) Configuration - auto-generated
    sp_entity_id = db.Column(db.String(500))  # Our Entity ID
    sp_acs_url = db.Column(db.String(500))  # Assertion Consumer Service URL
    sp_slo_url = db.Column(db.String(500))  # Our SLO URL
    sp_metadata_url = db.Column(db.String(500))  # Our metadata URL
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = db.Column(db.DateTime)
    
    # Statistics
    total_sso_logins = db.Column(db.Integer, default=0)
    
    # Relationships
    organization = db.relationship('Organization', backref=db.backref('sso_config', uselist=False))
    
    def to_dict(self, include_secrets=False):
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'sso_type': self.sso_type,
            'is_enabled': self.is_enabled,
            'enforce_sso': self.enforce_sso,
            'auto_provision_users': self.auto_provision_users,
            'default_role': self.default_role,
            'allowed_domains': self.allowed_domains or [],
            'attribute_mapping': self.attribute_mapping or {},
            'role_mapping': self.role_mapping or {},
            'sp_entity_id': self.sp_entity_id,
            'sp_acs_url': self.sp_acs_url,
            'sp_metadata_url': self.sp_metadata_url,
            'total_sso_logins': self.total_sso_logins,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        # SAML fields
        if self.sso_type == 'saml':
            data.update({
                'saml_entity_id': self.saml_entity_id,
                'saml_sso_url': self.saml_sso_url,
                'saml_slo_url': self.saml_slo_url,
                'saml_signature_algorithm': self.saml_signature_algorithm,
                'saml_name_id_format': self.saml_name_id_format,
                'saml_certificate_configured': bool(self.saml_certificate),
            })
            if include_secrets:
                data['saml_certificate'] = self.saml_certificate
        
        # OIDC fields
        if self.sso_type in ['oidc', 'azure_ad', 'okta', 'google']:
            data.update({
                'oidc_client_id': self.oidc_client_id,
                'oidc_issuer_url': self.oidc_issuer_url,
                'oidc_authorization_url': self.oidc_authorization_url,
                'oidc_token_url': self.oidc_token_url,
                'oidc_userinfo_url': self.oidc_userinfo_url,
                'oidc_scopes': self.oidc_scopes,
                'oidc_client_secret_configured': bool(self.oidc_client_secret),
            })
            if include_secrets:
                data['oidc_client_secret'] = self.oidc_client_secret
        
        return data


class SSOLoginAttempt(db.Model):
    """Log of SSO login attempts for audit and debugging."""
    
    __tablename__ = 'sso_login_attempts'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    # Attempt details
    email = db.Column(db.String(255))
    idp_user_id = db.Column(db.String(255))  # User ID from Identity Provider
    
    # Result
    success = db.Column(db.Boolean, default=False)
    error_code = db.Column(db.String(50))
    error_message = db.Column(db.Text)
    
    # User created/matched
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    user_provisioned = db.Column(db.Boolean, default=False)  # Was user auto-created
    
    # Request details
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(500))
    
    # SAML/OIDC response data (for debugging)
    response_data = db.Column(db.JSON)  # Sanitized assertion data
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization')
    user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'email': self.email,
            'success': self.success,
            'error_code': self.error_code,
            'error_message': self.error_message,
            'user_id': self.user_id,
            'user_provisioned': self.user_provisioned,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
