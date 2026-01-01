"""
SSO/SAML Authentication Routes for enterprise single sign-on.
"""
from flask import Blueprint, request, jsonify, redirect, url_for, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token, create_refresh_token
from datetime import datetime
import secrets
import hashlib
import base64
import urllib.parse

from ..extensions import db
from ..models import User, Organization, SSOConfiguration, SSOLoginAttempt

bp = Blueprint('sso', __name__)


# =============================================================================
# SSO CONFIGURATION MANAGEMENT
# =============================================================================

@bp.route('/config', methods=['GET'])
@jwt_required()
def get_sso_config():
    """Get SSO configuration for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    config = SSOConfiguration.query.filter_by(
        organization_id=user.organization_id
    ).first()
    
    if not config:
        return jsonify({'config': None}), 200
    
    return jsonify({'config': config.to_dict(include_secrets=False)}), 200


@bp.route('/config', methods=['POST', 'PUT'])
@jwt_required()
def update_sso_config():
    """Create or update SSO configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    sso_type = data.get('sso_type')
    
    if sso_type not in ['saml', 'oidc', 'azure_ad', 'okta', 'google']:
        return jsonify({'error': 'Invalid SSO type'}), 400
    
    config = SSOConfiguration.query.filter_by(
        organization_id=user.organization_id
    ).first()
    
    if not config:
        config = SSOConfiguration(
            organization_id=user.organization_id,
            sso_type=sso_type
        )
        db.session.add(config)
    
    # Update common fields
    config.sso_type = sso_type
    config.is_enabled = data.get('is_enabled', config.is_enabled)
    config.enforce_sso = data.get('enforce_sso', config.enforce_sso)
    config.auto_provision_users = data.get('auto_provision_users', config.auto_provision_users)
    config.default_role = data.get('default_role', config.default_role)
    config.allowed_domains = data.get('allowed_domains', config.allowed_domains)
    config.attribute_mapping = data.get('attribute_mapping', config.attribute_mapping)
    config.role_mapping = data.get('role_mapping', config.role_mapping)
    
    # Update SAML fields
    if sso_type == 'saml':
        config.saml_entity_id = data.get('saml_entity_id', config.saml_entity_id)
        config.saml_sso_url = data.get('saml_sso_url', config.saml_sso_url)
        config.saml_slo_url = data.get('saml_slo_url', config.saml_slo_url)
        config.saml_certificate = data.get('saml_certificate', config.saml_certificate)
        config.saml_signature_algorithm = data.get('saml_signature_algorithm', config.saml_signature_algorithm)
        config.saml_name_id_format = data.get('saml_name_id_format', config.saml_name_id_format)
    
    # Update OIDC fields
    if sso_type in ['oidc', 'azure_ad', 'okta', 'google']:
        config.oidc_client_id = data.get('oidc_client_id', config.oidc_client_id)
        if data.get('oidc_client_secret'):
            config.oidc_client_secret = data['oidc_client_secret']  # TODO: Encrypt
        config.oidc_issuer_url = data.get('oidc_issuer_url', config.oidc_issuer_url)
        config.oidc_authorization_url = data.get('oidc_authorization_url', config.oidc_authorization_url)
        config.oidc_token_url = data.get('oidc_token_url', config.oidc_token_url)
        config.oidc_userinfo_url = data.get('oidc_userinfo_url', config.oidc_userinfo_url)
        config.oidc_scopes = data.get('oidc_scopes', config.oidc_scopes)
    
    # Generate SP metadata URLs
    base_url = current_app.config.get('BASE_URL', 'http://localhost:5000')
    org_slug = user.organization.slug if hasattr(user.organization, 'slug') else str(user.organization_id)
    config.sp_entity_id = f'{base_url}/api/sso/{org_slug}'
    config.sp_acs_url = f'{base_url}/api/sso/{org_slug}/callback'
    config.sp_slo_url = f'{base_url}/api/sso/{org_slug}/logout'
    config.sp_metadata_url = f'{base_url}/api/sso/{org_slug}/metadata'
    
    db.session.commit()
    
    return jsonify({
        'message': 'SSO configuration updated',
        'config': config.to_dict()
    }), 200


@bp.route('/config/test', methods=['POST'])
@jwt_required()
def test_sso_config():
    """Test SSO configuration (validate settings)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    config = SSOConfiguration.query.filter_by(
        organization_id=user.organization_id
    ).first()
    
    if not config:
        return jsonify({'error': 'SSO not configured'}), 400
    
    errors = []
    warnings = []
    
    # Validate based on type
    if config.sso_type == 'saml':
        if not config.saml_entity_id:
            errors.append('SAML Entity ID is required')
        if not config.saml_sso_url:
            errors.append('SAML SSO URL is required')
        if not config.saml_certificate:
            errors.append('SAML Certificate is required')
        else:
            # Basic certificate validation
            try:
                cert = config.saml_certificate.strip()
                if not cert.startswith('-----BEGIN CERTIFICATE-----'):
                    warnings.append('Certificate should start with -----BEGIN CERTIFICATE-----')
            except:
                errors.append('Invalid certificate format')
    
    elif config.sso_type in ['oidc', 'azure_ad', 'okta', 'google']:
        if not config.oidc_client_id:
            errors.append('OIDC Client ID is required')
        if not config.oidc_client_secret:
            errors.append('OIDC Client Secret is required')
        if not config.oidc_issuer_url and config.sso_type == 'oidc':
            errors.append('OIDC Issuer URL is required')
    
    # Common validations
    if config.allowed_domains:
        for domain in config.allowed_domains:
            if not domain.startswith('@'):
                warnings.append(f'Domain {domain} should start with @')
    
    return jsonify({
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }), 200


@bp.route('/config', methods=['DELETE'])
@jwt_required()
def delete_sso_config():
    """Delete SSO configuration."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    config = SSOConfiguration.query.filter_by(
        organization_id=user.organization_id
    ).first()
    
    if not config:
        return jsonify({'error': 'SSO not configured'}), 404
    
    db.session.delete(config)
    db.session.commit()
    
    return jsonify({'message': 'SSO configuration deleted'}), 200


# =============================================================================
# SSO LOGIN FLOW
# =============================================================================

@bp.route('/<org_identifier>/login', methods=['GET'])
def initiate_sso_login(org_identifier):
    """Initiate SSO login for an organization."""
    # Find organization by slug or ID
    org = Organization.query.filter(
        (Organization.id == org_identifier) | 
        (Organization.name == org_identifier)
    ).first()
    
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    config = SSOConfiguration.query.filter_by(
        organization_id=org.id,
        is_enabled=True
    ).first()
    
    if not config:
        return jsonify({'error': 'SSO not enabled for this organization'}), 400
    
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state in session or cache (simplified - use Redis in production)
    # For now, we'll encode org_id in state
    state_data = f'{org.id}:{state}'
    encoded_state = base64.urlsafe_b64encode(state_data.encode()).decode()
    
    if config.sso_type == 'saml':
        # Generate SAML AuthnRequest
        # In production, use python3-saml library
        return jsonify({
            'redirect_url': config.saml_sso_url,
            'sso_type': 'saml',
            'message': 'Redirect to SAML IdP'
        }), 200
    
    elif config.sso_type in ['oidc', 'azure_ad', 'okta', 'google']:
        # Build OIDC authorization URL
        params = {
            'client_id': config.oidc_client_id,
            'response_type': 'code',
            'scope': config.oidc_scopes,
            'redirect_uri': config.sp_acs_url,
            'state': encoded_state,
            'nonce': secrets.token_urlsafe(16)
        }
        
        auth_url = config.oidc_authorization_url
        if not auth_url:
            # Default URLs for known providers
            if config.sso_type == 'azure_ad':
                auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
            elif config.sso_type == 'google':
                auth_url = 'https://accounts.google.com/o/oauth2/v2/auth'
            elif config.sso_type == 'okta':
                auth_url = f'{config.oidc_issuer_url}/v1/authorize'
        
        redirect_url = f'{auth_url}?{urllib.parse.urlencode(params)}'
        
        return jsonify({
            'redirect_url': redirect_url,
            'sso_type': config.sso_type
        }), 200
    
    return jsonify({'error': 'Unknown SSO type'}), 400


@bp.route('/<org_identifier>/callback', methods=['GET', 'POST'])
def sso_callback(org_identifier):
    """Handle SSO callback from IdP."""
    # Find organization
    org = Organization.query.filter(
        (Organization.id == org_identifier) | 
        (Organization.name == org_identifier)
    ).first()
    
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    config = SSOConfiguration.query.filter_by(
        organization_id=org.id
    ).first()
    
    if not config:
        return jsonify({'error': 'SSO not configured'}), 400
    
    # Log the attempt
    attempt = SSOLoginAttempt(
        organization_id=org.id,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string[:500] if request.user_agent else None
    )
    
    try:
        if config.sso_type == 'saml':
            # Process SAML Response
            # In production, use python3-saml to validate and parse
            saml_response = request.form.get('SAMLResponse')
            if not saml_response:
                raise ValueError('No SAML response received')
            
            # Decode and parse (simplified)
            # In production: parse XML, validate signature, extract attributes
            user_data = _parse_saml_response(saml_response, config)
            
        elif config.sso_type in ['oidc', 'azure_ad', 'okta', 'google']:
            # Exchange code for tokens
            code = request.args.get('code')
            if not code:
                raise ValueError('No authorization code received')
            
            # Exchange code for tokens (simplified)
            user_data = _exchange_oidc_code(code, config)
        
        else:
            raise ValueError('Unknown SSO type')
        
        # Find or create user
        email = user_data.get('email')
        if not email:
            raise ValueError('Email not provided by IdP')
        
        # Check allowed domains
        if config.allowed_domains:
            domain = '@' + email.split('@')[1]
            if domain not in config.allowed_domains:
                raise ValueError(f'Email domain {domain} not allowed')
        
        user = User.query.filter_by(email=email).first()
        
        if not user:
            if not config.auto_provision_users:
                raise ValueError('User not found and auto-provisioning disabled')
            
            # Create new user
            user = User(
                email=email,
                name=user_data.get('name', email.split('@')[0]),
                organization_id=org.id,
                role=config.default_role,
                is_active=True,
                password_hash='SSO_USER'  # No password for SSO users
            )
            db.session.add(user)
            attempt.user_provisioned = True
        
        # Verify user belongs to this org
        if user.organization_id != org.id:
            raise ValueError('User belongs to different organization')
        
        # Update last login
        user.last_login = datetime.utcnow()
        
        # Update SSO config stats
        config.last_login_at = datetime.utcnow()
        config.total_sso_logins = (config.total_sso_logins or 0) + 1
        
        # Record successful attempt
        attempt.email = email
        attempt.user_id = user.id
        attempt.success = True
        
        db.session.add(attempt)
        db.session.commit()
        
        # Generate JWT tokens
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        # Redirect to frontend with tokens
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        redirect_url = f'{frontend_url}/sso/callback?access_token={access_token}&refresh_token={refresh_token}'
        
        return redirect(redirect_url)
        
    except Exception as e:
        attempt.success = False
        attempt.error_message = str(e)
        db.session.add(attempt)
        db.session.commit()
        
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        error_url = f'{frontend_url}/sso/error?message={urllib.parse.quote(str(e))}'
        return redirect(error_url)


@bp.route('/<org_identifier>/metadata', methods=['GET'])
def get_sp_metadata(org_identifier):
    """Get SAML Service Provider metadata."""
    org = Organization.query.filter(
        (Organization.id == org_identifier) | 
        (Organization.name == org_identifier)
    ).first()
    
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    config = SSOConfiguration.query.filter_by(
        organization_id=org.id
    ).first()
    
    if not config or config.sso_type != 'saml':
        return jsonify({'error': 'SAML not configured'}), 400
    
    # Generate SP metadata XML
    metadata = f'''<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="{config.sp_entity_id}">
    <md:SPSSODescriptor AuthnRequestsSigned="true"
                        WantAssertionsSigned="true"
                        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <md:NameIDFormat>{config.saml_name_id_format}</md:NameIDFormat>
        <md:AssertionConsumerService 
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="{config.sp_acs_url}"
            index="0"
            isDefault="true"/>
        <md:SingleLogoutService 
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="{config.sp_slo_url}"/>
    </md:SPSSODescriptor>
</md:EntityDescriptor>'''
    
    return metadata, 200, {'Content-Type': 'application/xml'}


@bp.route('/login-attempts', methods=['GET'])
@jwt_required()
def get_login_attempts():
    """Get SSO login attempts for audit."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    limit = request.args.get('limit', 50, type=int)
    
    attempts = SSOLoginAttempt.query.filter_by(
        organization_id=user.organization_id
    ).order_by(SSOLoginAttempt.created_at.desc()).limit(limit).all()
    
    return jsonify({
        'attempts': [a.to_dict() for a in attempts]
    }), 200


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _parse_saml_response(saml_response: str, config: SSOConfiguration) -> dict:
    """Parse SAML response and extract user attributes."""
    # In production, use python3-saml library for proper parsing and validation
    # This is a placeholder that would be replaced with actual SAML parsing
    
    # Decode base64
    try:
        decoded = base64.b64decode(saml_response)
        # Parse XML and extract attributes
        # For now, return empty - implement with python3-saml
        return {
            'email': None,  # Extract from NameID or attribute
            'name': None,
            'groups': []
        }
    except Exception as e:
        raise ValueError(f'Failed to parse SAML response: {e}')


def _exchange_oidc_code(code: str, config: SSOConfiguration) -> dict:
    """Exchange OIDC authorization code for tokens and user info."""
    import requests
    
    token_url = config.oidc_token_url
    if not token_url:
        if config.sso_type == 'azure_ad':
            token_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
        elif config.sso_type == 'google':
            token_url = 'https://oauth2.googleapis.com/token'
        elif config.sso_type == 'okta':
            token_url = f'{config.oidc_issuer_url}/v1/token'
    
    # Exchange code for tokens
    token_response = requests.post(token_url, data={
        'grant_type': 'authorization_code',
        'code': code,
        'client_id': config.oidc_client_id,
        'client_secret': config.oidc_client_secret,
        'redirect_uri': config.sp_acs_url
    })
    
    if token_response.status_code != 200:
        raise ValueError(f'Token exchange failed: {token_response.text}')
    
    tokens = token_response.json()
    access_token = tokens.get('access_token')
    
    # Get user info
    userinfo_url = config.oidc_userinfo_url
    if not userinfo_url:
        if config.sso_type == 'azure_ad':
            userinfo_url = 'https://graph.microsoft.com/oidc/userinfo'
        elif config.sso_type == 'google':
            userinfo_url = 'https://openidconnect.googleapis.com/v1/userinfo'
        elif config.sso_type == 'okta':
            userinfo_url = f'{config.oidc_issuer_url}/v1/userinfo'
    
    userinfo_response = requests.get(userinfo_url, headers={
        'Authorization': f'Bearer {access_token}'
    })
    
    if userinfo_response.status_code != 200:
        raise ValueError(f'Failed to get user info: {userinfo_response.text}')
    
    userinfo = userinfo_response.json()
    
    # Map attributes based on configuration
    attr_map = config.attribute_mapping or {}
    
    return {
        'email': userinfo.get(attr_map.get('email', 'email')),
        'name': userinfo.get(attr_map.get('name', 'name')) or 
                f"{userinfo.get(attr_map.get('first_name', 'given_name'), '')} {userinfo.get(attr_map.get('last_name', 'family_name'), '')}".strip(),
        'groups': userinfo.get(attr_map.get('groups', 'groups'), [])
    }
