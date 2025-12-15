"""
File preview endpoint for knowledge items.
"""
import os
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import KnowledgeItem, User

bp = Blueprint('preview', __name__)


def get_absolute_path(file_path):
    """Convert relative file path to absolute path."""
    if not file_path:
        return None
    
    # Already absolute
    if file_path.startswith('/'):
        return file_path
    
    # Relative path - make absolute from /app
    return os.path.join('/app', file_path)


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
    if item.source_type == 'manual' or not item.file_path:
        return jsonify({
            'type': 'text',
            'title': item.title,
            'content': item.content,
            'metadata': item.item_metadata
        }), 200
    
    abs_path = get_absolute_path(item.file_path)
    
    # Check if file exists
    if not abs_path or not os.path.exists(abs_path):
        return jsonify({
            'type': 'document',
            'title': item.title,
            'content': item.content,
            'file_type': item.file_type,
            'file_name': item.source_file,
            'can_download': False,
            'error': 'File not found on disk'
        }), 200
    
    file_type = item.file_type or ''
    
    # For text files, return content
    if file_type.startswith('text/') or abs_path.endswith(('.txt', '.md', '.csv')):
        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return jsonify({
                'type': 'text',
                'title': item.title,
                'content': content,
                'file_type': file_type,
                'can_download': True
            }), 200
        except Exception as e:
            return jsonify({'error': f'Could not read file: {str(e)}'}), 500
    
    # For PDFs and other documents, return metadata + extracted text
    return jsonify({
        'type': 'document',
        'title': item.title,
        'content': item.content,  # Extracted text
        'file_type': file_type,
        'file_name': item.source_file,
        'can_download': True
    }), 200


@bp.route('/<int:item_id>/download', methods=['GET'])
@jwt_required()
def download_file(item_id):
    """Download the original file."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    item = KnowledgeItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    if item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    abs_path = get_absolute_path(item.file_path)
    
    if not abs_path or not os.path.exists(abs_path):
        return jsonify({'error': 'File not available'}), 404
    
    return send_file(
        abs_path,
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
    
    abs_path = get_absolute_path(item.file_path)
    
    if not abs_path or not os.path.exists(abs_path):
        return jsonify({'error': 'File not available'}), 404
    
    # Determine MIME type
    mime_type = item.file_type or 'application/octet-stream'
    if abs_path.endswith('.pdf'):
        mime_type = 'application/pdf'
    
    return send_file(
        abs_path,
        mimetype=mime_type,
        as_attachment=False  # Inline display
    )
