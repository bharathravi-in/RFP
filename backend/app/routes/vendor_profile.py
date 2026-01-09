"""Vendor Profile Routes - API endpoints for vendor profile management."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import logging

from app.models import User
from app.services.vendor_profile_service import VendorProfileService
from app.services.bulk_upload_service import BulkUploadService

logger = logging.getLogger(__name__)

bp = Blueprint('vendor_profile', __name__, url_prefix='/api/vendor-profile')


# Profile Management
@bp.route('', methods=['GET'])
@jwt_required()
def get_vendor_profile():
    """Get vendor profile for current organization."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_profile_summary(user.organization_id)
        return jsonify(profile), 200
        
    except Exception as e:
        logger.error(f"Error fetching vendor profile: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('', methods=['POST', 'PUT'])
@jwt_required()
def update_vendor_profile():
    """Create or update vendor profile."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        data = request.get_json()
        profile = VendorProfileService.update_profile(user.organization_id, data)
        
        return jsonify(profile.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error updating vendor profile: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Client Management
@bp.route('/clients', methods=['GET'])
@jwt_required()
def get_clients():
    """Get all clients for vendor profile."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        
        # Get filter parameters
        filters = {}
        if request.args.get('relationship_status'):
            filters['relationship_status'] = request.args.get('relationship_status')
        if request.args.get('client_industry'):
            filters['client_industry'] = request.args.get('client_industry')
        if request.args.get('client_size'):
            filters['client_size'] = request.args.get('client_size')
        
        clients = VendorProfileService.get_clients(profile.id, filters if filters else None)
        return jsonify([client.to_dict() for client in clients]), 200
        
    except Exception as e:
        logger.error(f"Error fetching clients: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/clients', methods=['POST'])
@jwt_required()
def add_client():
    """Add a new client."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        data = request.get_json()
        
        client = VendorProfileService.add_client(profile.id, data)
        return jsonify(client.to_dict()), 201
        
    except Exception as e:
        logger.error(f"Error adding client: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/clients/<int:client_id>', methods=['PUT'])
@jwt_required()
def update_client(client_id):
    """Update a client."""
    try:
        data = request.get_json()
        client = VendorProfileService.update_client(client_id, data)
        return jsonify(client.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error updating client: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/clients/<int:client_id>', methods=['DELETE'])
@jwt_required()
def delete_client(client_id):
    """Delete a client."""
    try:
        VendorProfileService.delete_client(client_id)
        return jsonify({'message': 'Client deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting client: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Success Stories Management
@bp.route('/success-stories', methods=['GET'])
@jwt_required()
def get_success_stories():
    """Get all success stories."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        
        # Get filter parameters
        filters = {}
        if request.args.get('industry'):
            filters['industry'] = request.args.get('industry')
        if request.args.get('is_featured'):
            filters['is_featured'] = request.args.get('is_featured') == 'true'
        if request.args.get('tags'):
            filters['tags'] = request.args.get('tags').split(',')
        
        stories = VendorProfileService.get_success_stories(profile.id, filters if filters else None)
        return jsonify([story.to_dict() for story in stories]), 200
        
    except Exception as e:
        logger.error(f"Error fetching success stories: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/success-stories', methods=['POST'])
@jwt_required()
def add_success_story():
    """Add a new success story."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        data = request.get_json()
        
        story = VendorProfileService.add_success_story(profile.id, data)
        return jsonify(story.to_dict()), 201
        
    except Exception as e:
        logger.error(f"Error adding success story: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/success-stories/<int:story_id>', methods=['PUT'])
@jwt_required()
def update_success_story(story_id):
    """Update a success story."""
    try:
        data = request.get_json()
        story = VendorProfileService.update_success_story(story_id, data)
        return jsonify(story.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error updating success story: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/success-stories/<int:story_id>', methods=['DELETE'])
@jwt_required()
def delete_success_story(story_id):
    """Delete a success story."""
    try:
        VendorProfileService.delete_success_story(story_id)
        return jsonify({'message': 'Success story deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting success story: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/success-stories/<int:story_id>/feature', methods=['POST'])
@jwt_required()
def toggle_featured_story(story_id):
    """Toggle featured status of a success story."""
    try:
        story = VendorProfileService.toggle_featured_story(story_id)
        return jsonify(story.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error toggling featured story: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Capabilities Management
@bp.route('/capabilities', methods=['GET'])
@jwt_required()
def get_capabilities():
    """Get all capabilities."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        core_only = request.args.get('core_only') == 'true'
        
        capabilities = VendorProfileService.get_capabilities(profile.id, core_only)
        return jsonify([cap.to_dict() for cap in capabilities]), 200
        
    except Exception as e:
        logger.error(f"Error fetching capabilities: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/capabilities', methods=['POST'])
@jwt_required()
def add_capability():
    """Add a new capability."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        data = request.get_json()
        
        capability = VendorProfileService.add_capability(profile.id, data)
        return jsonify(capability.to_dict()), 201
        
    except Exception as e:
        logger.error(f"Error adding capability: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/capabilities/<int:capability_id>', methods=['PUT'])
@jwt_required()
def update_capability(capability_id):
    """Update a capability."""
    try:
        data = request.get_json()
        capability = VendorProfileService.update_capability(capability_id, data)
        return jsonify(capability.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error updating capability: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/capabilities/<int:capability_id>', methods=['DELETE'])
@jwt_required()
def delete_capability(capability_id):
    """Delete a capability."""
    try:
        VendorProfileService.delete_capability(capability_id)
        return jsonify({'message': 'Capability deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting capability: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Testimonials Management
@bp.route('/testimonials', methods=['GET'])
@jwt_required()
def get_testimonials():
    """Get all testimonials."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        verified_only = request.args.get('verified_only') == 'true'
        
        testimonials = VendorProfileService.get_testimonials(profile.id, verified_only)
        return jsonify([test.to_dict() for test in testimonials]), 200
        
    except Exception as e:
        logger.error(f"Error fetching testimonials: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/testimonials', methods=['POST'])
@jwt_required()
def add_testimonial():
    """Add a new testimonial."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        profile = VendorProfileService.get_or_create_profile(user.organization_id)
        data = request.get_json()
        
        testimonial = VendorProfileService.add_testimonial(profile.id, data)
        return jsonify(testimonial.to_dict()), 201
        
    except Exception as e:
        logger.error(f"Error adding testimonial: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/testimonials/<int:testimonial_id>', methods=['PUT'])
@jwt_required()
def update_testimonial(testimonial_id):
    """Update a testimonial."""
    try:
        data = request.get_json()
        testimonial = VendorProfileService.update_testimonial(testimonial_id, data)
        return jsonify(testimonial.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error updating testimonial: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/testimonials/<int:testimonial_id>', methods=['DELETE'])
@jwt_required()
def delete_testimonial(testimonial_id):
    """Delete a testimonial."""
    try:
        VendorProfileService.delete_testimonial(testimonial_id)
        return jsonify({'message': 'Testimonial deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting testimonial: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/testimonials/<int:testimonial_id>/verify', methods=['POST'])
@jwt_required()
def verify_testimonial(testimonial_id):
    """Verify a testimonial."""
    try:
        data = request.get_json()
        method = data.get('verification_method', 'manual')
        
        testimonial = VendorProfileService.verify_testimonial(testimonial_id, method)
        return jsonify(testimonial.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error verifying testimonial: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Bulk Upload Endpoints
@bp.route('/bulk-upload/<string:upload_type>', methods=['POST'])
@jwt_required()
def bulk_upload(upload_type):
    """Bulk upload data from CSV or Excel file.
    
    Supported types: clients, stories, capabilities, testimonials
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.organization_id:
            return jsonify({'error': 'User not associated with an organization'}), 400
        
        # Validate upload type
        valid_types = ['clients', 'stories', 'capabilities', 'testimonials']
        if upload_type not in valid_types:
            return jsonify({'error': f'Invalid upload type. Must be one of: {", ".join(valid_types)}'}), 400
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Parse file
        try:
            rows = BulkUploadService.parse_file(file)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        
        if not rows:
            return jsonify({'error': 'File is empty or has no valid data'}), 400
        
        # Process rows based on type
        success_count = 0
        error_count = 0
        errors = []
        
        for idx, row in enumerate(rows, start=2):  # Start from 2 (assuming row 1 is header)
            try:
                if upload_type == 'clients':
                    data = BulkUploadService.process_client_row(row)
                    if data.get('client_name'):
                        VendorProfileService.add_client(user.organization_id, data)
                        success_count += 1
                    else:
                        errors.append(f"Row {idx}: Missing required field 'client_name'")
                        error_count += 1
                
                elif upload_type == 'stories':
                    data = BulkUploadService.process_story_row(row)
                    if data.get('title'):
                        VendorProfileService.add_success_story(user.organization_id, data)
                        success_count += 1
                    else:
                        errors.append(f"Row {idx}: Missing required field 'title'")
                        error_count += 1
                
                elif upload_type == 'capabilities':
                    data = BulkUploadService.process_capability_row(row)
                    if data.get('capability_name'):
                        VendorProfileService.add_capability(user.organization_id, data)
                        success_count += 1
                    else:
                        errors.append(f"Row {idx}: Missing required field 'capability_name'")
                        error_count += 1
                
                elif upload_type == 'testimonials':
                    data = BulkUploadService.process_testimonial_row(row)
                    if data.get('testimonial_text'):
                        VendorProfileService.add_testimonial(user.organization_id, data)
                        success_count += 1
                    else:
                        errors.append(f"Row {idx}: Missing required field 'testimonial_text'")
                        error_count += 1
                        
            except Exception as e:
                logger.error(f"Error processing row {idx}: {str(e)}")
                errors.append(f"Row {idx}: {str(e)}")
                error_count += 1
        
        # Return summary
        response = {
            'success': True,
            'message': f'Processed {len(rows)} rows',
            'success_count': success_count,
            'error_count': error_count,
        }
        
        if errors:
            response['errors'] = errors[:10]  # Limit to first 10 errors
            if len(errors) > 10:
                response['errors'].append(f'... and {len(errors) - 10} more errors')
        
        return jsonify(response), 200 if error_count == 0 else 207  # 207 = Multi-Status
        
    except Exception as e:
        logger.error(f"Error in bulk upload: {str(e)}")
        return jsonify({'error': str(e)}), 500
