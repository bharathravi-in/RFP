import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import Document, Project, User

bp = Blueprint('documents', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'xlsx', 'doc', 'xls'}


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
    
    # Save file
    upload_folder = current_app.config['UPLOAD_FOLDER']
    project_folder = os.path.join(upload_folder, str(project_id))
    os.makedirs(project_folder, exist_ok=True)
    
    file_path = os.path.join(project_folder, unique_filename)
    file.save(file_path)
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    # Create document record
    document = Document(
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_type=ext,
        file_size=file_size,
        status='pending',
        project_id=project_id,
        uploaded_by=user_id
    )
    
    db.session.add(document)
    db.session.commit()
    
    # TODO: Trigger async processing task
    # from ..tasks import process_document
    # process_document.delay(document.id)
    
    return jsonify({
        'message': 'Document uploaded',
        'document': document.to_dict()
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
    from datetime import datetime
    from ..services.document_service import DocumentService
    from ..services.extraction_service import QuestionExtractor
    from ..models import Question
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Update status
    document.status = 'processing'
    db.session.commit()
    
    try:
        # Extract text from document
        doc_service = DocumentService()
        extracted_text = doc_service.extract_text(document.file_path, document.file_type)
        
        if not extracted_text:
            document.status = 'failed'
            document.error_message = 'Could not extract text from document'
            db.session.commit()
            return jsonify({'error': 'Text extraction failed'}), 400
        
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
        
        return jsonify({
            'message': 'Document parsed successfully',
            'document': document.to_dict(),
            'questions_extracted': len(questions_data)
        }), 200
        
    except Exception as e:
        document.status = 'failed'
        document.error_message = str(e)
        db.session.commit()
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500


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
