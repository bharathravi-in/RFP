"""
Document Chat API Routes

REST API endpoints for document-specific chat functionality.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import User, Document
from app.models.document_chat import DocumentChatSession, DocumentChatMessage
from app.services.document_chat_service import get_document_chat_service

bp = Blueprint('document_chat', __name__, url_prefix='/api/documents')


@bp.route('/<int:document_id>/chat', methods=['GET'])
@jwt_required()
def get_chat_session(document_id):
    """
    Get or create chat session for a document.
    Returns session with summary, suggestions, and existing messages.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Verify document exists and user has access
    document = Document.query.get(document_id)
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    # Get or create session
    service = get_document_chat_service(user.organization_id)
    session, is_new = service.get_or_create_session(document_id, user_id)
    
    # Generate summary if new session
    if is_new or not session.summary:
        service.generate_summary(session)
    
    # Get message history
    messages = service.get_chat_history(session)
    
    return jsonify({
        'session': session.to_dict(),
        'messages': messages,
        'document': {
            'id': document.id,
            'filename': document.original_filename or document.filename,
            'originalFilename': document.original_filename,
            'fileType': document.file_type,
            'storageType': document.storage_type,
            'previewUrl': f'/api/documents/{document.id}/preview'
        }
    })


@bp.route('/<int:document_id>/chat', methods=['POST'])
@jwt_required()
def send_message(document_id):
    """
    Send a message in the document chat.
    Returns AI response.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    message = data.get('message', '').strip()
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    # Get session
    session = DocumentChatSession.query.filter_by(
        document_id=document_id,
        user_id=user_id
    ).first()
    
    if not session:
        # Create session if doesn't exist
        service = get_document_chat_service(user.organization_id)
        session, _ = service.get_or_create_session(document_id, user_id)
    else:
        service = get_document_chat_service(user.organization_id)
    
    # Process message and get response
    response_msg = service.chat(session, message)
    
    return jsonify({
        'message': response_msg.to_dict(),
        'session': session.to_dict()
    })


@bp.route('/<int:document_id>/chat/history', methods=['GET'])
@jwt_required()
def get_history(document_id):
    """
    Get chat history for a document.
    """
    user_id = get_jwt_identity()
    
    session = DocumentChatSession.query.filter_by(
        document_id=document_id,
        user_id=user_id
    ).first()
    
    if not session:
        return jsonify({'messages': []})
    
    service = get_document_chat_service()
    messages = service.get_chat_history(session)
    
    return jsonify({'messages': messages})


@bp.route('/<int:document_id>/chat/suggestions', methods=['POST'])
@jwt_required()
def regenerate_suggestions(document_id):
    """
    Regenerate suggestions for a document.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    session = DocumentChatSession.query.filter_by(
        document_id=document_id,
        user_id=user_id
    ).first()
    
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    service = get_document_chat_service(user.organization_id)
    result = service.generate_summary(session)
    
    return jsonify({
        'suggestions': result.get('suggestions', [])
    })


@bp.route('/<int:document_id>/chat/clear', methods=['DELETE'])
@jwt_required()
def clear_history(document_id):
    """
    Clear chat history for a document.
    """
    user_id = get_jwt_identity()
    
    session = DocumentChatSession.query.filter_by(
        document_id=document_id,
        user_id=user_id
    ).first()
    
    if session:
        # Delete all messages
        DocumentChatMessage.query.filter_by(session_id=session.id).delete()
        db.session.commit()
    
    return jsonify({'success': True})
