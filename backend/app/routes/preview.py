"""
File preview endpoint for knowledge items.
Serves file content from database (file_data column).
"""
import os
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import KnowledgeItem, User

bp = Blueprint('preview', __name__)


@bp.route('/<int:item_id>', methods=['GET'])
@jwt_required()
def preview_file(item_id):
    """Get file content for preview."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # For manual entries, return content directly
    if item.source_type == 'manual' or not item.file_data:
        return jsonify({
            'type': 'text',
            'title': item.title,
            'content': item.content,
            'metadata': item.item_metadata
        }), 200
    
    file_type = item.file_type or ''
    
    # For text files, decode and return content
    if file_type.startswith('text/') or (item.source_file and item.source_file.endswith(('.txt', '.md', '.csv'))):
        try:
            content = item.file_data.decode('utf-8')
            return jsonify({
                'type': 'text',
                'title': item.title,
                'content': content,
                'file_type': file_type,
                'can_download': True
            }), 200
        except Exception as e:
            # Fall back to extracted content
            return jsonify({
                'type': 'document',
                'title': item.title,
                'content': item.content,
                'file_type': file_type,
                'file_name': item.source_file,
                'can_download': True
            }), 200
    
    # For PDFs and other documents, return metadata + extracted text
    return jsonify({
        'type': 'document',
        'title': item.title,
        'content': item.content,  # Extracted text
        'file_type': file_type,
        'file_name': item.source_file,
        'file_size': item.file_size,
        'can_download': True
    }), 200


@bp.route('/<int:item_id>/download', methods=['GET'])
@jwt_required()
def download_file(item_id):
    """Download the original file from database."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not item.file_data:
        return jsonify({'error': 'File not available'}), 404
    
    # Create BytesIO from file_data
    file_buffer = BytesIO(item.file_data)
    
    return send_file(
        file_buffer,
        mimetype=item.file_type or 'application/octet-stream',
        as_attachment=True,
        download_name=item.source_file or item.title
    )


@bp.route('/<int:item_id>/file', methods=['GET'])
@jwt_required()
def serve_file(item_id):
    """Serve file for inline viewing (PDF preview in iframe)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not item.file_data:
        return jsonify({'error': 'File not available'}), 404
    
    # Determine MIME type
    mime_type = item.file_type or 'application/octet-stream'
    if item.source_file and item.source_file.endswith('.pdf'):
        mime_type = 'application/pdf'
    
    # Create BytesIO from file_data
    file_buffer = BytesIO(item.file_data)
    
    return send_file(
        file_buffer,
        mimetype=mime_type,
        as_attachment=False  # Inline display
    )
