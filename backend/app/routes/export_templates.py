"""Export Templates API Routes."""
import os
import uuid
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import ExportTemplate, User

bp = Blueprint('export_templates', __name__)

ALLOWED_EXTENSIONS = {'docx', 'pptx'}
UPLOAD_FOLDER = 'uploads/templates'


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_template_type(filename: str) -> str:
    """Get template type from filename."""
    ext = filename.rsplit('.', 1)[1].lower()
    return ext


@bp.route('', methods=['GET'])
@jwt_required()
def list_templates():
    """List all export templates for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    template_type = request.args.get('type')
    
    query = ExportTemplate.query.filter_by(organization_id=user.organization_id)
    
    if template_type:
        query = query.filter_by(template_type=template_type)
    
    templates = query.order_by(ExportTemplate.created_at.desc()).all()
    
    return jsonify({
        'templates': [t.to_dict() for t in templates]
    })


@bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_template():
    """Upload a new export template (DOCX or PPTX)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Only DOCX and PPTX files are allowed'}), 400
    
    # Get form data
    name = request.form.get('name', file.filename)
    description = request.form.get('description', '')
    set_as_default = request.form.get('is_default', 'false').lower() == 'true'
    
    # Secure filename and save
    filename = secure_filename(file.filename)
    template_type = get_template_type(filename)
    
    # Create upload directory if not exists
    upload_dir = os.path.join(current_app.root_path, '..', UPLOAD_FOLDER, str(user.organization_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # Save file
    file.save(file_path)
    file_size = os.path.getsize(file_path)
    
    # If setting as default, unset other defaults of same type
    if set_as_default:
        ExportTemplate.query.filter_by(
            organization_id=user.organization_id,
            template_type=template_type,
            is_default=True
        ).update({'is_default': False})
    
    # Create database record
    template = ExportTemplate(
        name=name,
        description=description,
        template_type=template_type,
        file_path=file_path,
        file_name=filename,
        file_size=file_size,
        is_default=set_as_default,
        organization_id=user.organization_id,
        created_by_id=user.id
    )
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify({
        'message': 'Template uploaded successfully',
        'template': template.to_dict()
    }), 201


@bp.route('/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_template(template_id):
    """Delete an export template."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    template = ExportTemplate.query.get(template_id)
    
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    if template.organization_id != user.organization_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Delete file
    try:
        if os.path.exists(template.file_path):
            os.remove(template.file_path)
    except Exception as e:
        current_app.logger.error(f"Error deleting template file: {e}")
    
    db.session.delete(template)
    db.session.commit()
    
    return jsonify({'message': 'Template deleted'})


@bp.route('/<int:template_id>/set-default', methods=['PUT'])
@jwt_required()
def set_default_template(template_id):
    """Set a template as the default for its type."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    template = ExportTemplate.query.get(template_id)
    
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    if template.organization_id != user.organization_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Unset other defaults of same type
    ExportTemplate.query.filter_by(
        organization_id=user.organization_id,
        template_type=template.template_type,
        is_default=True
    ).update({'is_default': False})
    
    # Set this as default
    template.is_default = True
    db.session.commit()
    
    return jsonify({
        'message': 'Template set as default',
        'template': template.to_dict()
    })


@bp.route('/<int:template_id>/download', methods=['GET'])
@jwt_required()
def download_template(template_id):
    """Download a template file."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    template = ExportTemplate.query.get(template_id)
    
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    if template.organization_id != user.organization_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not os.path.exists(template.file_path):
        return jsonify({'error': 'Template file not found'}), 404
    
    return send_file(
        template.file_path,
        as_attachment=True,
        download_name=template.file_name
    )


@bp.route('/default/<template_type>', methods=['GET'])
@jwt_required()
def get_default_template(template_type):
    """Get the default template for a type."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if template_type not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Invalid template type'}), 400
    
    template = ExportTemplate.query.filter_by(
        organization_id=user.organization_id,
        template_type=template_type,
        is_default=True
    ).first()
    
    if not template:
        return jsonify({'template': None})
    
    return jsonify({'template': template.to_dict()})
