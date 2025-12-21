"""
Organization routes for CRUD operations.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Organization

bp = Blueprint('organizations', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def get_organization():
    """Get current user's organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.organization:
        return jsonify({'organization': None}), 200
    
    return jsonify({'organization': user.organization.to_dict()}), 200


@bp.route('', methods=['POST'])
@jwt_required()
def create_organization():
    """Create a new organization (for users without one)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.organization_id:
        return jsonify({'error': 'User already belongs to an organization'}), 400
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Organization name is required'}), 400
    
    # Generate slug from name
    slug = data['name'].lower().replace(' ', '-').replace('_', '-')
    # Ensure unique slug
    base_slug = slug
    counter = 1
    while Organization.query.filter_by(slug=slug).first():
        slug = f'{base_slug}-{counter}'
        counter += 1
    
    # Create organization
    organization = Organization(
        name=data['name'],
        slug=slug,
        settings=data.get('settings', {})
    )
    db.session.add(organization)
    db.session.flush()
    
    # Assign user to organization as admin
    user.organization_id = organization.id
    user.role = 'admin'
    
    db.session.commit()
    
    return jsonify({
        'message': 'Organization created successfully',
        'organization': organization.to_dict()
    }), 201


@bp.route('/<int:org_id>', methods=['PUT'])
@jwt_required()
def update_organization(org_id):
    """Update organization details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.organization_id or user.organization_id != org_id:
        return jsonify({'error': 'Not authorized to update this organization'}), 403
    
    if user.role != 'admin':
        return jsonify({'error': 'Only admins can update organization'}), 403
    
    organization = Organization.query.get(org_id)
    if not organization:
        return jsonify({'error': 'Organization not found'}), 404
    
    data = request.get_json()
    
    # Update name
    if 'name' in data:
        organization.name = data['name']
        # Update slug if name changed
        new_slug = data['name'].lower().replace(' ', '-').replace('_', '-')
        if new_slug != organization.slug:
            base_slug = new_slug
            counter = 1
            while Organization.query.filter(
                Organization.slug == new_slug,
                Organization.id != org_id
            ).first():
                new_slug = f'{base_slug}-{counter}'
                counter += 1
            organization.slug = new_slug
    
    # Update settings
    if 'settings' in data:
        organization.settings = {**(organization.settings or {}), **data['settings']}
    
    db.session.commit()
    
    return jsonify({
        'message': 'Organization updated successfully',
        'organization': organization.to_dict()
    }), 200


@bp.route('/<int:org_id>', methods=['DELETE'])
@jwt_required()
def delete_organization(org_id):
    """Delete organization (admin only, with confirmation)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.organization_id or user.organization_id != org_id:
        return jsonify({'error': 'Not authorized to delete this organization'}), 403
    
    if user.role != 'admin':
        return jsonify({'error': 'Only admins can delete organization'}), 403
    
    organization = Organization.query.get(org_id)
    if not organization:
        return jsonify({'error': 'Organization not found'}), 404
    
    # Check if confirmation was provided
    data = request.get_json() or {}
    if not data.get('confirm'):
        return jsonify({
            'error': 'Please confirm deletion',
            'message': 'Send {"confirm": true} to confirm organization deletion. This will remove all associated data.'
        }), 400
    
    # Remove organization_id from all users
    for org_user in organization.users:
        org_user.organization_id = None
        org_user.role = 'viewer'
    
    # Delete the organization (cascades will handle related data)
    db.session.delete(organization)
    db.session.commit()
    
    return jsonify({'message': 'Organization deleted successfully'}), 200


@bp.route('/extract-vendor-profile', methods=['POST'])
@jwt_required()
def extract_vendor_profile():
    """Extract vendor profile information from uploaded document using AI."""
    import tempfile
    import os
    from ..services.document_service import DocumentService
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User must belong to an organization'}), 400
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    
    # Get file extension
    filename = file.filename
    file_ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    
    allowed_extensions = ['pdf', 'docx', 'doc', 'pptx', 'ppt']
    if file_ext not in allowed_extensions:
        return jsonify({'error': f'Unsupported file type. Allowed: {", ".join(allowed_extensions)}'}), 400
    
    # Save temporarily
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, filename)
    
    try:
        file.save(temp_path)
        
        # Extract text from document
        document_text = DocumentService.extract_text(temp_path, file_ext)
        
        if not document_text or len(document_text.strip()) < 50:
            return jsonify({'error': 'Could not extract sufficient text from document'}), 400
        
        # Use AI to extract vendor profile
        import google.generativeai as genai
        
        genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""Analyze the following company document and extract vendor profile information.

DOCUMENT TEXT:
{document_text[:8000]}

Extract the following information and return ONLY a valid JSON object with these fields:
- registration_country: The country where the company is registered/headquartered (string)
- years_in_business: How many years the company has been operating (number or null if not found)
- employee_count: Number of employees/team size (number or null if not found)
- certifications: List of certifications like ISO 27001, SOC 2, GDPR, etc. (array of strings)
- geographies: List of regions/countries where the company operates (array of strings)

If a field cannot be determined from the document, use null for numbers and empty array [] for lists.
Return ONLY the JSON object, no markdown, no explanation.

Example response:
{{"registration_country": "United States", "years_in_business": 10, "employee_count": 150, "certifications": ["ISO 27001", "SOC 2"], "geographies": ["North America", "Europe"]}}
"""
        
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Parse JSON response
        import json
        # Clean up response if it has markdown code blocks
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        response_text = response_text.strip()
        
        try:
            vendor_profile = json.loads(response_text)
        except json.JSONDecodeError:
            return jsonify({'error': 'Failed to parse AI response', 'raw_response': response_text}), 500
        
        return jsonify({
            'message': 'Vendor profile extracted successfully',
            'vendor_profile': vendor_profile,
            'source_document': filename
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to process document: {str(e)}'}), 500
    finally:
        # Cleanup temp files
        try:
            os.remove(temp_path)
            os.rmdir(temp_dir)
        except:
            pass

