"""
Co-Pilot API Routes

Provides chat endpoints for the Tarento Co-Pilot AI assistant.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.copilot_service import CoPilotService
from app.models import User, CoPilotSession, CoPilotMessage
from app.extensions import db
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('copilot', __name__, url_prefix='/api/copilot')


@bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_sessions():
    """Get all chat sessions for the current user."""
    try:
        user_id = get_jwt_identity()
        sessions = CoPilotSession.query.filter_by(user_id=user_id)\
            .order_by(CoPilotSession.updated_at.desc()).all()
        return jsonify({
            'success': True,
            'sessions': [s.to_dict() for s in sessions]
        }), 200
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/sessions', methods=['POST'])
@jwt_required()
def create_session():
    """Create a new chat session."""
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        
        session = CoPilotSession(
            user_id=user_id,
            title=data.get('title', 'New Chat'),
            mode=data.get('mode', 'general')
        )
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'session': session.to_dict()
        }), 201
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/sessions/<int:session_id>', methods=['GET'])
@jwt_required()
def get_session(session_id):
    """Get a specific session with messages."""
    try:
        user_id = get_jwt_identity()
        session = CoPilotSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        return jsonify({
            'success': True,
            'session': session.to_dict(include_messages=True)
        }), 200
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/sessions/<int:session_id>', methods=['PUT'])
@jwt_required()
def update_session(session_id):
    """Update session title."""
    try:
        user_id = get_jwt_identity()
        session = CoPilotSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        data = request.get_json() or {}
        if 'title' in data:
            session.title = data['title']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'session': session.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Error updating session: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_session(session_id):
    """Delete a chat session."""
    try:
        user_id = get_jwt_identity()
        session = CoPilotSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        db.session.delete(session)
        db.session.commit()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/sessions/<int:session_id>/chat', methods=['POST'])
@jwt_required()
def chat(session_id):
    """
    Send a message and get AI response.
    """
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        session = CoPilotSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        data = request.get_json()
        if not data or not data.get('content'):
            return jsonify({'success': False, 'error': 'No content provided'}), 400
        
        content = data.get('content')
        mode = data.get('mode', session.mode)
        agent_id = data.get('agent_id')
        use_web_search = data.get('use_web_search', False)
        
        # Save user message
        user_message = CoPilotMessage(
            session_id=session_id,
            role='user',
            content=content,
            status='complete'
        )
        db.session.add(user_message)
        
        # Update session title if it's the first message
        if session.title == 'New Chat':
            session.title = content[:40] + ('...' if len(content) > 40 else '')
        
        db.session.commit()
        
        # Get conversation history
        history = [{'role': m.role, 'content': m.content} 
                   for m in session.messages.filter(CoPilotMessage.role != 'system').all()]
        
        # Generate AI response
        org_id = user.organization_id if user else None
        service = CoPilotService(organization_id=org_id)
        result = service.chat(
            messages=history,
            mode=mode,
            agent_id=agent_id,
            use_web_search=use_web_search
        )
        
        # Save AI response
        ai_message = CoPilotMessage(
            session_id=session_id,
            role='assistant',
            content=result.get('content', 'Error generating response'),
            agent_name=result.get('agent'),
            status='complete' if result.get('success') else 'error'
        )
        db.session.add(ai_message)
        db.session.commit()
        
        return jsonify({
            'success': result.get('success', False),
            'content': result.get('content'),
            'agent': result.get('agent'),
            'userMessage': user_message.to_dict(),
            'aiMessage': ai_message.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"CoPilot chat error: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e),
            'content': 'An unexpected error occurred.'
        }), 500


@bp.route('/agents', methods=['GET'])
@jwt_required()
def get_agents():
    """Get list of available agents."""
    try:
        service = CoPilotService()
        agents = service.get_available_agents()
        return jsonify({'success': True, 'agents': agents}), 200
    except Exception as e:
        logger.error(f"Error getting agents: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'copilot'}), 200
