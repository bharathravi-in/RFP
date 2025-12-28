"""
Knowledge item chat API routes.
Similar to document chat but for knowledge base items.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import logging

from app import db
from app.models import User, KnowledgeItem
from app.models.document_chat import DocumentChatSession, DocumentChatMessage
from app.services.document_chat_service import get_document_chat_service

logger = logging.getLogger(__name__)

bp = Blueprint('knowledge_chat', __name__)


@bp.route('/<int:item_id>/chat', methods=['GET'])
@jwt_required()
def get_knowledge_chat_session(item_id):
    """Get or create a chat session for a knowledge item."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Verify knowledge item exists and user has access
    knowledge_item = KnowledgeItem.query.get(item_id)
    if not knowledge_item:
        return jsonify({'error': 'Knowledge item not found'}), 404
    
    # Check if item belongs to user's organization
    if knowledge_item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get or create session (reuse document chat models)
    session = DocumentChatSession.query.filter_by(
        document_id=item_id,  # We repurpose document_id for knowledge item
        user_id=user_id
    ).first()
    
    is_new = False
    if not session:
        session = DocumentChatSession(
            document_id=item_id,  # Stores knowledge item id
            user_id=user_id
        )
        db.session.add(session)
        db.session.commit()
        is_new = True
    
    # Generate summary if new session
    if is_new or not session.summary:
        _generate_knowledge_summary(session, knowledge_item, user.organization_id)
    
    # Get message history
    messages = DocumentChatMessage.query.filter_by(
        session_id=session.id
    ).order_by(DocumentChatMessage.created_at).all()
    
    return jsonify({
        'session': {
            'id': session.id,
            'knowledgeItemId': item_id,
            'summary': session.summary,
            'keyPoints': session.key_points or [],
            'suggestions': session.suggestions or []
        },
        'messages': [
            {
                'id': m.id,
                'role': m.role,
                'content': m.content,
                'timestamp': m.created_at.isoformat() if m.created_at else None
            } for m in messages
        ],
        'knowledgeItem': {
            'id': knowledge_item.id,
            'title': knowledge_item.title,
            'fileType': knowledge_item.file_type,
            'previewUrl': f'/api/preview/{knowledge_item.id}',
            'storageType': knowledge_item.item_metadata.get('storage_type') if knowledge_item.item_metadata else None
        }
    })


@bp.route('/<int:item_id>/chat', methods=['POST'])
@jwt_required()
def send_knowledge_message(item_id):
    """Send a message in a knowledge item chat session."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    message = data.get('message', '').strip()
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    # Get knowledge item
    knowledge_item = KnowledgeItem.query.get(item_id)
    if not knowledge_item:
        return jsonify({'error': 'Knowledge item not found'}), 404
    
    if knowledge_item.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get session
    session = DocumentChatSession.query.filter_by(
        document_id=item_id,
        user_id=user_id
    ).first()
    
    if not session:
        session = DocumentChatSession(
            document_id=item_id,
            user_id=user_id
        )
        db.session.add(session)
        db.session.commit()
    
    # Save user message
    user_msg = DocumentChatMessage(
        session_id=session.id,
        role='user',
        content=message
    )
    db.session.add(user_msg)
    
    # Generate AI response
    response_text = _generate_knowledge_response(
        knowledge_item, message, user.organization_id
    )
    
    # Save assistant message
    assistant_msg = DocumentChatMessage(
        session_id=session.id,
        role='assistant',
        content=response_text
    )
    db.session.add(assistant_msg)
    
    # Update session timestamp
    session.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'message': {
            'id': assistant_msg.id,
            'role': 'assistant',
            'content': response_text,
            'timestamp': assistant_msg.created_at.isoformat() if assistant_msg.created_at else None
        },
        'session': {
            'id': session.id,
            'knowledgeItemId': item_id,
            'summary': session.summary,
            'keyPoints': session.key_points or [],
            'suggestions': session.suggestions or []
        }
    })


def _generate_knowledge_summary(session, knowledge_item, org_id):
    """Generate summary for a knowledge item."""
    try:
        from app.services.llm_service_helper import get_llm_provider
        
        llm = get_llm_provider(org_id, 'document_chat')
        content = knowledge_item.content or ''
        
        if not content:
            session.summary = f"This is a {knowledge_item.file_type or 'document'} file: {knowledge_item.title}"
            session.key_points = ["Content preview not available for this file type"]
            session.suggestions = [
                f"What is the main purpose of {knowledge_item.title}?",
                "Can you summarize the key information in this document?"
            ]
            db.session.commit()
            return
        
        # Generate summary
        prompt = f"""Analyze this document and provide:
1. A brief overview (2-3 sentences)
2. 3-5 key points
3. 2 relevant questions a user might ask about this document

Document content:
{content[:30000]}

Respond in this format:
OVERVIEW:
[Your overview here]

KEY POINTS:
- [Point 1]
- [Point 2]
- [Point 3]

SUGGESTED QUESTIONS:
- [Question 1]
- [Question 2]
"""
        
        response = llm.generate_content(prompt)
        
        # Parse response
        overview = ""
        key_points = []
        suggestions = []
        
        lines = response.split('\n')
        section = None
        
        for line in lines:
            line = line.strip()
            if 'OVERVIEW:' in line.upper():
                section = 'overview'
            elif 'KEY POINTS:' in line.upper():
                section = 'keypoints'
            elif 'SUGGESTED QUESTIONS:' in line.upper():
                section = 'suggestions'
            elif line.startswith('-') or line.startswith('•'):
                content = line.lstrip('-•').strip()
                if section == 'keypoints':
                    key_points.append(content)
                elif section == 'suggestions':
                    suggestions.append(content)
            elif section == 'overview' and line:
                overview += line + ' '
        
        session.summary = overview.strip() or f"Document: {knowledge_item.title}"
        session.key_points = key_points[:5] or ["Document content analyzed"]
        session.suggestions = suggestions[:2] or [
            f"What is the main purpose of {knowledge_item.title}?",
            "What are the key takeaways from this document?"
        ]
        db.session.commit()
        
    except Exception as e:
        logger.error(f"Failed to generate knowledge summary: {e}")
        session.summary = f"Knowledge document: {knowledge_item.title}"
        session.key_points = ["Summary generation failed - try asking a question"]
        session.suggestions = [
            f"What is this document about?",
            "Can you summarize the main points?"
        ]
        db.session.commit()


def _generate_knowledge_response(knowledge_item, question, org_id):
    """Generate AI response for a knowledge item question."""
    try:
        from app.services.llm_service_helper import get_llm_provider
        
        llm = get_llm_provider(org_id, 'document_chat')
        content = knowledge_item.content or ''
        
        if not content:
            return f"I don't have access to the content of this {knowledge_item.file_type or 'document'} file. Please try viewing the document directly."
        
        prompt = f"""Based on the following document content, answer this question:

Question: {question}

Document ({knowledge_item.title}):
{content[:30000]}

Provide a helpful, accurate answer based on the document content. If the information is not in the document, say so clearly.
"""
        
        response = llm.generate_content(prompt)
        return response
        
    except Exception as e:
        logger.error(f"Failed to generate knowledge response: {e}")
        return f"I encountered an error processing your question: {str(e)}"
