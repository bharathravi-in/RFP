"""
Knowledge Folder Routes for hierarchical organization.
"""
import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import KnowledgeItem, KnowledgeFolder, User

bp = Blueprint('folders', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt', 'xlsx', 'xls', 'csv', 'md'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('', methods=['GET'])
@jwt_required()
def list_folders():
    """List all folders in a tree structure."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    # Get root folders (no parent)
    root_folders = KnowledgeFolder.query.filter_by(
        organization_id=user.organization_id,
        parent_id=None,
        is_active=True
    ).order_by(KnowledgeFolder.sort_order, KnowledgeFolder.name).all()
    
    return jsonify({
        'folders': [f.to_dict(include_children=True) for f in root_folders]
    }), 200


@bp.route('', methods=['POST'])
@jwt_required()
def create_folder():
    """Create a new folder."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Folder name required'}), 400
    
    # Validate parent folder
    parent_id = data.get('parent_id')
    if parent_id:
        parent = KnowledgeFolder.query.get(parent_id)
        if not parent or parent.organization_id != user.organization_id:
            return jsonify({'error': 'Invalid parent folder'}), 400
    
    folder = KnowledgeFolder(
        name=data['name'],
        description=data.get('description'),
        parent_id=parent_id,
        icon=data.get('icon', 'folder'),
        color=data.get('color'),
        organization_id=user.organization_id,
        created_by=user_id
    )
    
    db.session.add(folder)
    db.session.commit()
    
    return jsonify({
        'message': 'Folder created',
        'folder': folder.to_dict()
    }), 201


@bp.route('/<int:folder_id>', methods=['GET'])
@jwt_required()
def get_folder(folder_id):
    """Get folder with contents."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    folder = KnowledgeFolder.query.get(folder_id)
    
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    if folder.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'folder': folder.to_dict(include_children=True, include_items=True),
        'path': folder.get_path()
    }), 200


@bp.route('/<int:folder_id>', methods=['PUT'])
@jwt_required()
def update_folder(folder_id):
    """Update folder details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    folder = KnowledgeFolder.query.get(folder_id)
    
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    if folder.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        folder.name = data['name']
    if 'description' in data:
        folder.description = data['description']
    if 'icon' in data:
        folder.icon = data['icon']
    if 'color' in data:
        folder.color = data['color']
    if 'parent_id' in data:
        # Prevent circular reference
        if data['parent_id'] != folder.id:
            folder.parent_id = data['parent_id']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Folder updated',
        'folder': folder.to_dict()
    }), 200


@bp.route('/<int:folder_id>', methods=['DELETE'])
@jwt_required()
def delete_folder(folder_id):
    """Delete folder (soft delete)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    folder = KnowledgeFolder.query.get(folder_id)
    
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    if folder.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Soft delete folder and contents
    folder.is_active = False
    for item in folder.items:
        item.is_active = False
    for child in folder.children:
        child.is_active = False
    
    db.session.commit()
    
    return jsonify({'message': 'Folder deleted'}), 200


@bp.route('/<int:folder_id>/upload', methods=['POST'])
@jwt_required()
def upload_to_folder(folder_id):
    """Upload files to a folder."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    folder = KnowledgeFolder.query.get(folder_id)
    
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    if folder.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    # Read dimension data from form
    geography = request.form.get('geography')
    client_type = request.form.get('client_type')
    industry = request.form.get('industry')
    knowledge_profile_id = request.form.get('knowledge_profile_id')
    if knowledge_profile_id:
        knowledge_profile_id = int(knowledge_profile_id)
    
    files = request.files.getlist('files')
    uploaded = []
    errors = []
    
    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            
            # Read file content into memory
            file_content = file.read()
            file_size = len(file_content)
            
            # Extract text content for indexing using temp file
            content = f"File: {filename}\n\n[Content pending extraction]"
            try:
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                    temp_file.write(file_content)
                    temp_path = temp_file.name
                
                from ..services.extraction_text_service import extract_text_from_file
                content = extract_text_from_file(temp_path, file.content_type)
                if not content or len(content.strip()) < 10:
                    content = f"File: {filename}\n\n[Content could not be extracted. Download to view.]"
                
                # Clean up temp file
                os.unlink(temp_path)
            except Exception as e:
                content = f"File: {filename}\n\n[Extraction error: {str(e)}]"
                try:
                    os.unlink(temp_path)
                except:
                    pass
            
            # Create knowledge item with file data and dimension fields
            item = KnowledgeItem(
                title=filename,
                content=content,
                source_type='file',
                source_file=filename,
                file_type=file.content_type,
                file_data=file_content,  # Store binary in database
                file_size=file_size,
                folder_id=folder_id,
                geography=geography,
                client_type=client_type,
                industry=industry,
                knowledge_profile_id=knowledge_profile_id,
                organization_id=user.organization_id,
                created_by=user_id
            )
            db.session.add(item)
            db.session.flush()  # Get item.id
            
            # Index in Qdrant with dimension fields
            try:
                from ..services.qdrant_service import get_qdrant_service
                qdrant = get_qdrant_service(user.organization_id)
                item.embedding_id = qdrant.upsert_item(
                    item_id=item.id,
                    org_id=user.organization_id,
                    title=item.title,
                    content=item.content,
                    folder_id=folder_id,
                    geography=geography,
                    client_type=client_type,
                    industry=industry,
                    knowledge_profile_id=knowledge_profile_id
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to index item {item.id} in Qdrant: {e}")
            
            uploaded.append({
                'filename': filename,
                'id': item.id
            })
        else:
            errors.append({
                'filename': file.filename if file else 'unknown',
                'error': 'Invalid file type'
            })
    
    db.session.commit()
    
    return jsonify({
        'uploaded': uploaded,
        'errors': errors,
        'count': len(uploaded)
    }), 201


@bp.route('/move-item', methods=['POST'])
@jwt_required()
def move_item():
    """Move a knowledge item to a different folder."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    item_id = data.get('item_id')
    target_folder_id = data.get('folder_id')  # None for root
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if target_folder_id:
        folder = KnowledgeFolder.query.get(target_folder_id)
        if not folder or folder.organization_id != user.organization_id:
            return jsonify({'error': 'Invalid target folder'}), 400
    
    item.folder_id = target_folder_id
    db.session.commit()
    
    return jsonify({
        'message': 'Item moved',
        'item': item.to_dict()
    }), 200
