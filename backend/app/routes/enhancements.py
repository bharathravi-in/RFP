"""
API Routes for New Enhancement Features

Provides endpoints for:
- LLM usage/cost tracking
- Embedding cache stats
- Batch export
- Streaming responses
"""
from flask import Blueprint, jsonify, request, Response, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import io

from app.models import User

bp = Blueprint('enhancements', __name__, url_prefix='/api')


# ============================================================================
# LLM Usage & Cost Tracking
# ============================================================================

@bp.route('/usage/summary', methods=['GET'])
@jwt_required()
def get_usage_summary():
    """Get LLM usage summary for the current organization."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    days = request.args.get('days', 30, type=int)
    
    try:
        from app.services.llm_usage import get_usage_summary
        summary = get_usage_summary(user.organization_id, days=days)
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Embedding Cache
# ============================================================================

@bp.route('/cache/stats', methods=['GET'])
@jwt_required()
def get_cache_stats():
    """Get embedding cache statistics."""
    try:
        from app.services.embedding_cache import get_cache_stats
        stats = get_cache_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/cache/clear', methods=['POST'])
@jwt_required()
def clear_cache():
    """Clear embedding cache."""
    try:
        from app.services.embedding_cache import clear_cache
        cleared = clear_cache()
        return jsonify({'cleared': cleared})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Batch Export
# ============================================================================

@bp.route('/projects/<int:project_id>/export/answers', methods=['GET'])
@jwt_required()
def export_project_answers(project_id):
    """Export all answers for a project."""
    format = request.args.get('format', 'csv')
    
    if format not in ('csv', 'excel', 'json'):
        return jsonify({'error': 'Invalid format. Use csv, excel, or json'}), 400
    
    try:
        from app.services.batch_export import BatchExportService
        
        file_bytes, filename, content_type = BatchExportService.export_project_answers(
            project_id, format=format
        )
        
        return send_file(
            io.BytesIO(file_bytes),
            mimetype=content_type,
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/answer-library/export', methods=['GET'])
@jwt_required()
def export_answer_library():
    """Export answer library for the organization."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    format = request.args.get('format', 'csv')
    
    try:
        from app.services.batch_export import BatchExportService
        
        file_bytes, filename, content_type = BatchExportService.export_answer_library(
            user.organization_id, format=format
        )
        
        return send_file(
            io.BytesIO(file_bytes),
            mimetype=content_type,
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/answer-library/import', methods=['POST'])
@jwt_required()
def import_answer_library():
    """Import answers from CSV/Excel file."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    filename = file.filename.lower()
    
    try:
        content = file.read()
        
        if filename.endswith('.csv'):
            from app.services.batch_export import import_answers_from_csv
            answers = import_answers_from_csv(content)
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            from app.services.batch_export import import_answers_from_excel
            answers = import_answers_from_excel(content)
        else:
            return jsonify({'error': 'Unsupported file format. Use CSV or Excel'}), 400
        
        # Import to answer library
        from app.models import AnswerLibraryItem
        from app import db
        
        imported = 0
        for answer_data in answers:
            item = AnswerLibraryItem(
                org_id=user.organization_id,
                question_text=answer_data['question_text'],
                answer_text=answer_data['answer_text'],
                category=answer_data.get('category', 'general')
            )
            db.session.add(item)
            imported += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported': imported
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Provider Health
# ============================================================================

@bp.route('/providers/health', methods=['GET'])
@jwt_required()
def get_provider_health():
    """Get health status of LLM providers."""
    try:
        from app.services.provider_fallback import get_fallback_chain
        chain = get_fallback_chain()
        return jsonify(chain.get_health())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Streaming (Server-Sent Events)
# ============================================================================

@bp.route('/ai/generate/stream', methods=['POST'])
@jwt_required()
def stream_generation():
    """Stream LLM response using Server-Sent Events."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    data = request.get_json()
    prompt = data.get('prompt')
    
    if not prompt:
        return jsonify({'error': 'Prompt required'}), 400
    
    def generate():
        """Generator for SSE events."""
        try:
            from app.services.llm_service_helper import get_llm_provider
            
            provider = get_llm_provider(user.organization_id, 'default')
            
            # For now, send full response as single chunk (streaming will be added to providers)
            result = provider.generate_content(prompt)
            
            # Send in chunks for demo
            chunk_size = 50
            for i in range(0, len(result), chunk_size):
                chunk = result[i:i+chunk_size]
                yield f"data: {chunk}\n\n"
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )
