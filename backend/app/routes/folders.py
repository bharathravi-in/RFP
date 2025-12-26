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
        is_global=data.get('is_global', False),  # NEW: Organization-wide folder
        category=data.get('category'),  # NEW: company_info, pricing, products, legal, etc.
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
    # NEW: Global folder settings
    if 'is_global' in data:
        folder.is_global = data['is_global']
    if 'category' in data:
        folder.category = data['category']
    
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
    """Upload files to a folder with Docling chunking and hybrid search."""
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
    
    import logging
    logger = logging.getLogger(__name__)
    
    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            
            # Read file content into memory
            file_content = file.read()
            file_size = len(file_content)
            
            # Create temp file for processing
            import tempfile
            temp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                    temp_file.write(file_content)
                    temp_path = temp_file.name
                
                # Use Docling for page-based chunking
                chunks = []
                full_text = ""
                try:
                    from ..services.docling_chunking_service import get_docling_chunking_service
                    
                    chunking_service = get_docling_chunking_service()
                    file_id = str(uuid.uuid4())
                    file_type = os.path.splitext(filename)[1].lstrip('.').lower()
                    
                    chunking_result = chunking_service.chunk_document(
                        file_path=temp_path,
                        file_id=file_id,
                        original_filename=filename,
                        file_type=file_type
                    )
                    
                    chunks = chunking_result.chunks
                    full_text = "\n\n".join([c.content for c in chunks[:5]])  # First 5 chunks for summary
                    
                    logger.info(f"Chunked {filename}: {len(chunks)} chunks, {chunking_result.total_pages} pages")
                    
                except Exception as e:
                    logger.warning(f"Docling chunking failed for {filename}, using fallback: {e}")
                    # Fallback to basic extraction
                    from ..services.extraction_text_service import extract_text_from_file
                    full_text = extract_text_from_file(temp_path, file.content_type)
                    if not full_text or len(full_text.strip()) < 10:
                        full_text = f"File: {filename}\n\n[Content could not be extracted. Download to view.]"
                    chunks = []
                
                # Create parent knowledge item (stores the full document)
                parent_item = KnowledgeItem(
                    title=filename,
                    content=full_text[:50000] if full_text else f"File: {filename}",  # Summary content
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
                    created_by=user_id,
                    item_metadata={
                        'total_chunks': len(chunks),
                        'total_pages': chunking_result.total_pages if chunks else 1,
                        'total_words': chunking_result.total_words if chunks else len(full_text.split()),
                        'chunking_method': 'docling' if chunks else 'basic'
                    }
                )
                db.session.add(parent_item)
                db.session.flush()  # Get parent_item.id
                
                # Index using hybrid search (combines dense + sparse vectors)
                try:
                    from ..services.hybrid_search_service import get_hybrid_search_service
                    
                    hybrid_search = get_hybrid_search_service(user.organization_id)
                    
                    if hybrid_search.enabled:
                        if chunks:
                            # Index each chunk with hybrid vectors
                            for chunk in chunks:
                                chunk.doc_url = f"knowledge://{parent_item.id}"
                                chunk.original_filename = filename
                            
                            indexed_count = hybrid_search.upsert_document_chunks(
                                chunks=chunks,
                                org_id=user.organization_id
                            )
                            
                            parent_item.embedding_id = f"hybrid:{file_id}"
                            parent_item.item_metadata['indexed_chunks'] = indexed_count
                            logger.info(f"Indexed {indexed_count} chunks for {filename}")
                        else:
                            # Index full content as single chunk
                            success = hybrid_search.upsert_document_chunk(
                                chunk_id=f"{parent_item.id}-0",
                                file_id=str(parent_item.id),
                                page_number=1,
                                content=full_text[:5000],
                                org_id=user.organization_id,
                                doc_url=f"knowledge://{parent_item.id}",
                                original_filename=filename
                            )
                            if success:
                                parent_item.embedding_id = f"hybrid:{parent_item.id}"
                except Exception as e:
                    logger.warning(f"Failed to index item {parent_item.id} in hybrid search: {e}")
                    # Fallback to regular Qdrant service
                    try:
                        from ..services.qdrant_service import get_qdrant_service
                        qdrant = get_qdrant_service(user.organization_id)
                        parent_item.embedding_id = qdrant.upsert_item(
                            item_id=parent_item.id,
                            org_id=user.organization_id,
                            title=parent_item.title,
                            content=parent_item.content,
                            folder_id=folder_id,
                            geography=geography,
                            client_type=client_type,
                            industry=industry,
                            knowledge_profile_id=knowledge_profile_id
                        )
                    except Exception as e2:
                        logger.warning(f"Fallback Qdrant indexing also failed: {e2}")
                
                # Create child knowledge items for each chunk (optional - for UI display)
                if chunks and len(chunks) > 1:
                    for i, chunk in enumerate(chunks):
                        chunk_item = KnowledgeItem(
                            title=f"{filename} - Page {chunk.page_number}",
                            content=chunk.content,
                            source_type='chunk',
                            source_file=filename,
                            chunk_index=i,
                            parent_id=parent_item.id,
                            folder_id=folder_id,
                            geography=geography,
                            client_type=client_type,
                            industry=industry,
                            knowledge_profile_id=knowledge_profile_id,
                            organization_id=user.organization_id,
                            created_by=user_id,
                            item_metadata={
                                'page_number': chunk.page_number,
                                'chunk_index': chunk.chunk_index,
                                'word_count': chunk.word_count,
                                'has_tables': chunk.has_tables,
                                'has_images': chunk.has_images,
                                'headings': chunk.headings
                            }
                        )
                        db.session.add(chunk_item)
                
                uploaded.append({
                    'filename': filename,
                    'id': parent_item.id,
                    'chunks': len(chunks),
                    'pages': chunking_result.total_pages if chunks else 1
                })
                
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
                errors.append({
                    'filename': filename,
                    'error': str(e)
                })
            finally:
                # Clean up temp file
                if temp_path:
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
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


# ============================================
# Global Folder & Project Linking Endpoints
# ============================================

@bp.route('/global', methods=['GET'])
@jwt_required()
def list_global_folders():
    """List all global/organization-wide folders."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    # Get global folders optionally filtered by category
    category = request.args.get('category')
    
    query = KnowledgeFolder.query.filter_by(
        organization_id=user.organization_id,
        is_global=True,
        is_active=True
    )
    
    if category:
        query = query.filter_by(category=category)
    
    folders = query.order_by(KnowledgeFolder.sort_order, KnowledgeFolder.name).all()
    
    return jsonify({
        'folders': [f.to_dict(include_children=True) for f in folders]
    }), 200


@bp.route('/<int:folder_id>/link-project', methods=['POST'])
@jwt_required()
def link_folder_to_project(folder_id):
    """Link a folder to a specific project for access."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    folder = KnowledgeFolder.query.get(folder_id)
    if not folder or folder.organization_id != user.organization_id:
        return jsonify({'error': 'Folder not found'}), 404
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'project_id required'}), 400
    
    from ..models import Project
    project = Project.query.get(project_id)
    
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    # Check if already linked
    if folder.linked_projects.filter_by(id=project_id).first():
        return jsonify({'message': 'Already linked', 'folder': folder.to_dict()}), 200
    
    # Link the folder to the project
    folder.linked_projects.append(project)
    db.session.commit()
    
    return jsonify({
        'message': 'Folder linked to project',
        'folder': folder.to_dict()
    }), 200


@bp.route('/<int:folder_id>/unlink-project', methods=['POST'])
@jwt_required()
def unlink_folder_from_project(folder_id):
    """Remove a folder's link to a specific project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    folder = KnowledgeFolder.query.get(folder_id)
    if not folder or folder.organization_id != user.organization_id:
        return jsonify({'error': 'Folder not found'}), 404
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'project_id required'}), 400
    
    from ..models import Project
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Remove the link
    if project in folder.linked_projects.all():
        folder.linked_projects.remove(project)
        db.session.commit()
    
    return jsonify({
        'message': 'Folder unlinked from project',
        'folder': folder.to_dict()
    }), 200


@bp.route('/for-project/<int:project_id>', methods=['GET'])
@jwt_required()
def list_folders_for_project(project_id):
    """List all folders accessible by a project (global + linked)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'User not in organization'}), 403
    
    from ..models import Project
    project = Project.query.get(project_id)
    
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    # Get all accessible folders using the helper method
    folders = KnowledgeFolder.get_folders_for_project(project_id, user.organization_id)
    
    return jsonify({
        'project_id': project_id,
        'folders': [f.to_dict(include_children=True) for f in folders]
    }), 200
