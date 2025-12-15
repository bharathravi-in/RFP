import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import Document, Project, User

bp = Blueprint('documents', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'xlsx', 'doc', 'xls'}


@bp.route('', methods=['GET'])
@jwt_required()
def list_documents():
    """List documents for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({'error': 'project_id required'}), 400
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    documents = Document.query.filter_by(project_id=project_id).order_by(Document.created_at.desc()).all()
    
    return jsonify({
        'documents': [d.to_dict() for d in documents]
    }), 200


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload a document to a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    project_id = request.form.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
    
    # Generate unique filename
    original_filename = secure_filename(file.filename)
    ext = original_filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    
    # Read file content into memory
    file_data = file.read()
    file_size = len(file_data)
    
    # Create document record with file data in DB
    document = Document(
        filename=unique_filename,
        original_filename=original_filename,
        file_data=file_data,  # Store binary content in DB
        file_type=ext,
        file_size=file_size,
        status='pending',
        project_id=project_id,
        uploaded_by=user_id
    )
    
    db.session.add(document)
    db.session.commit()
    
    # Auto-trigger document parsing
    parse_result = None
    try:
        from .documents import _parse_document_internal
        parse_result = _parse_document_internal(document)
    except Exception as e:
        parse_result = {'error': str(e)}
    
    return jsonify({
        'message': 'Document uploaded and processing started',
        'document': document.to_dict(),
        'parse_result': parse_result
    }), 201


@bp.route('/<int:document_id>', methods=['GET'])
@jwt_required()
def get_document(document_id):
    """Get document details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'document': document.to_dict()
    }), 200


@bp.route('/<int:document_id>/parse', methods=['POST'])
@jwt_required()
def parse_document(document_id):
    """Trigger document parsing and question extraction."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    result = _parse_document_internal(document)
    
    if 'error' in result:
        return jsonify(result), 500
    
    return jsonify(result), 200


def _parse_document_internal(document):
    """Internal function to parse document and extract questions."""
    import tempfile
    from datetime import datetime
    from ..services.document_service import DocumentService
    from ..services.extraction_service import QuestionExtractor
    from ..models import Question
    
    # Update status
    document.status = 'processing'
    db.session.commit()
    
    try:
        # Write file data to temp file for processing
        temp_file_path = None
        if document.file_data:
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=f'.{document.file_type}'
            )
            temp_file.write(document.file_data)
            temp_file.close()
            temp_file_path = temp_file.name
        elif document.file_path:
            temp_file_path = document.file_path
        
        if not temp_file_path:
            document.status = 'failed'
            document.error_message = 'No file data available'
            db.session.commit()
            return {'error': 'No file data available'}
        
        # Extract text from document
        doc_service = DocumentService()
        extracted_text = doc_service.extract_text(temp_file_path, document.file_type)
        
        # Clean up temp file
        if document.file_data and temp_file_path:
            import os as temp_os
            try:
                temp_os.unlink(temp_file_path)
            except:
                pass
        
        if not extracted_text:
            document.status = 'failed'
            document.error_message = 'Could not extract text from document'
            db.session.commit()
            return {'error': 'Text extraction failed'}
        
        # Save extracted text
        document.extracted_text = extracted_text
        document.file_metadata = {
            'word_count': len(extracted_text.split()),
            'char_count': len(extracted_text),
        }
        
        # Extract questions
        extractor = QuestionExtractor()
        questions_data = extractor.extract_questions(extracted_text, use_ai=True)
        
        # Create Question records
        for q_data in questions_data:
            question = Question(
                text=q_data['text'],
                section=q_data.get('section', 'General'),
                order=q_data.get('order', 0),
                status='pending',
                project_id=document.project_id,
                document_id=document.id
            )
            db.session.add(question)
        
        # Update document status
        document.status = 'completed'
        document.processed_at = datetime.utcnow()
        db.session.commit()
        
        return {
            'message': 'Document parsed successfully',
            'document': document.to_dict(),
            'questions_extracted': len(questions_data)
        }
        
    except Exception as e:
        document.status = 'failed'
        document.error_message = str(e)
        db.session.commit()
        return {'error': f'Processing failed: {str(e)}'}


@bp.route('/<int:document_id>', methods=['DELETE'])
@jwt_required()
def delete_document(document_id):
    """Delete a document."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Delete file
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    db.session.delete(document)
    db.session.commit()
    
    return jsonify({'message': 'Document deleted'}), 200
