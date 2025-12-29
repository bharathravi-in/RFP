"""
Proposal Chat API Routes

Chat-style proposal generation endpoints.
Uses RFP documents + Knowledge Base to generate proposal sections.
"""
import logging
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import User, Project, Document, Question
from app.models.rfp_section import RFPSection

logger = logging.getLogger(__name__)


bp = Blueprint('proposal_chat', __name__, url_prefix='/api/projects')


def get_llm_provider(org_id: int):
    """Get LLM provider for the organization."""
    try:
        from app.services.llm_service_helper import get_llm_provider as get_provider
        return get_provider(org_id, 'proposal_chat')
    except Exception as e:
        logger.warning(f"Could not get LLM provider: {e}")
        return None


# Section types for proposal generation
SECTION_TYPES = {
    'executive_summary': {
        'name': 'Executive Summary',
        'prompt': 'Write a compelling executive summary for this RFP proposal. Focus on understanding the client needs, our key differentiators, and value proposition.',
        'icon': '📋'
    },
    'company_overview': {
        'name': 'Company Overview',
        'prompt': 'Write a company overview section highlighting our experience, capabilities, and why we are the ideal partner for this project.',
        'icon': '🏢'
    },
    'technical_approach': {
        'name': 'Technical Approach',
        'prompt': 'Write a detailed technical approach section describing our methodology, technologies, and implementation strategy to address the RFP requirements.',
        'icon': '⚙️'
    },
    'team_qualifications': {
        'name': 'Team Qualifications',
        'prompt': 'Write a team qualifications section showcasing the expertise and experience of the team members who will work on this project.',
        'icon': '👥'
    },
    'pricing': {
        'name': 'Pricing Strategy',
        'prompt': 'Write a pricing section outline with cost breakdown structure. Note: Specific numbers should be filled in by the user.',
        'icon': '💰'
    },
    'implementation': {
        'name': 'Implementation Plan',
        'prompt': 'Write an implementation plan section with timeline, milestones, and deliverables based on the RFP requirements.',
        'icon': '📅'
    },
    'case_studies': {
        'name': 'Case Studies',
        'prompt': 'Write relevant case studies section highlighting similar past projects and their outcomes.',
        'icon': '📚'
    }
}


@bp.route('/<int:project_id>/proposal-chat', methods=['GET'])
@jwt_required()
def get_proposal_session(project_id):
    """
    Get proposal chat session for a project.
    Returns project info, RFP summary, and chat history.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get project with documents
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Get RFP documents
    documents = Document.query.filter_by(project_id=project_id).all()
    
    # Get questions (extracted from RFP)
    questions = Question.query.filter_by(project_id=project_id).all()
    
    # Get proposal sections from database (the actual built sections)
    proposal_sections = RFPSection.query.filter_by(project_id=project_id).order_by(RFPSection.order).all()
    
    # Build RFP context summary
    rfp_summary = _build_rfp_summary(project, documents, questions)
    
    # Get or create session data from project metadata (safely handle None/non-dict)
    metadata = project.metadata if isinstance(project.metadata, dict) else {}
    chat_history = metadata.get('proposal_chat_history', [])
    generated_sections = metadata.get('proposal_sections', {})
    
    return jsonify({
        'project': {
            'id': project.id,
            'name': project.name,
            'description': project.description,
            'clientName': project.client_name,
            'dueDate': project.due_date.isoformat() if project.due_date else None
        },
        'documents': [{
            'id': doc.id,
            'filename': doc.original_filename or doc.filename,
            'fileType': doc.file_type,
            'previewUrl': f'/api/documents/{doc.id}/preview'
        } for doc in documents],
        'proposalSections': [section.to_dict(include_content=True) for section in proposal_sections],
        'rfpSummary': rfp_summary,
        'questionCount': len(questions),
        'sectionTypes': SECTION_TYPES,
        'chatHistory': chat_history,
        'generatedSections': generated_sections
    })



@bp.route('/<int:project_id>/proposal-chat', methods=['POST'])
@jwt_required()
def chat_proposal(project_id):
    """
    Send a chat message for proposal generation.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.get_json()
    message = data.get('message', '').strip()
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    # Build context from RFP
    documents = Document.query.filter_by(project_id=project_id).all()
    questions = Question.query.filter_by(project_id=project_id).all()
    rfp_context = _build_rfp_context(project, documents, questions)
    
    # Get chat history (safely handle non-dict metadata)
    if not isinstance(project.metadata, dict):
        project.metadata = {}
    chat_history = project.metadata.get('proposal_chat_history', [])

    
    # Add user message
    chat_history.append({
        'role': 'user',
        'content': message
    })
    
    # Generate AI response
    llm_provider = get_llm_provider(user.organization_id)
    
    if not llm_provider:
        response = "AI chat is not available. Please configure an LLM provider for your organization."
    else:
        system_prompt = f"""You are an expert RFP proposal consultant. Help the user create a winning proposal based on the RFP requirements.

RFP Context:
{rfp_context}

Guidelines:
- Be specific and detailed in your responses
- Reference specific RFP requirements when applicable
- Suggest improvements and best practices
- Format responses with clear headings and bullet points when appropriate
"""
        
        try:
            full_prompt = f"{system_prompt}\n\nUser: {message}"
            response = llm_provider.generate_content(full_prompt)
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            response = f"I encountered an error generating a response: {str(e)}"
    
    # Add AI response
    chat_history.append({
        'role': 'assistant',
        'content': response
    })
    
    # Save chat history
    project.metadata['proposal_chat_history'] = chat_history
    db.session.commit()
    
    return jsonify({
        'message': {
            'role': 'assistant',
            'content': response
        }
    })


@bp.route('/<int:project_id>/proposal-chat/generate-section', methods=['POST'])
@jwt_required()
def generate_section(project_id):
    """
    Generate a specific proposal section using AI.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.get_json()
    section_type = data.get('sectionType')
    custom_instructions = data.get('instructions', '')
    
    if section_type not in SECTION_TYPES:
        return jsonify({'error': 'Invalid section type'}), 400
    
    section_config = SECTION_TYPES[section_type]
    
    # Build RFP context
    documents = Document.query.filter_by(project_id=project_id).all()
    questions = Question.query.filter_by(project_id=project_id).all()
    rfp_context = _build_rfp_context(project, documents, questions)
    
    # Generate section
    llm_provider = get_llm_provider(user.organization_id)
    
    if not llm_provider:
        return jsonify({'error': 'No LLM provider configured'}), 400
    
    prompt = f"""{section_config['prompt']}

{f'Additional instructions: {custom_instructions}' if custom_instructions else ''}

RFP Context:
{rfp_context}

Generate a professional, well-structured {section_config['name']} section for this proposal.
Use markdown formatting with headers, bullet points, and clear structure.
"""
    
    try:
        response = llm_provider.generate_content(prompt)
    except Exception as e:
        logger.error(f"Section generation failed: {e}")
        return jsonify({'error': f'Generation failed: {str(e)}'}), 500
    
    # Save generated section (safely handle non-dict metadata)
    if not isinstance(project.metadata, dict):
        project.metadata = {}
    if 'proposal_sections' not in project.metadata:
        project.metadata['proposal_sections'] = {}

    
    project.metadata['proposal_sections'][section_type] = {
        'content': response,
        'generated_at': datetime.utcnow().isoformat()
    }
    db.session.commit()
    
    return jsonify({
        'section': {
            'type': section_type,
            'name': section_config['name'],
            'content': response
        }
    })


@bp.route('/<int:project_id>/proposal-chat/clear', methods=['DELETE'])
@jwt_required()
def clear_chat(project_id):
    """Clear proposal chat history."""
    user_id = get_jwt_identity()
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.metadata:
        project.metadata['proposal_chat_history'] = []
        db.session.commit()
    
    return jsonify({'message': 'Chat history cleared'})


def _build_rfp_summary(project, documents, questions):
    """Build a brief RFP summary for display."""
    summary = {
        'projectName': project.name,
        'clientName': project.client_name,
        'documentCount': len(documents),
        'questionCount': len(questions),
        'keyTopics': []
    }
    
    # Extract key topics from questions (top categories)
    categories = {}
    for q in questions:
        cat = q.category or 'general'
        categories[cat] = categories.get(cat, 0) + 1
    
    summary['keyTopics'] = sorted(categories.keys(), key=lambda x: categories[x], reverse=True)[:5]
    
    return summary


def _build_rfp_context(project, documents, questions):
    """Build detailed RFP context for AI prompts."""
    context_parts = [
        f"Project: {project.name}",
        f"Client: {project.client_name or 'Not specified'}",
        f"Description: {project.description or 'No description'}",
    ]
    
    if project.due_date:
        context_parts.append(f"Due Date: {project.due_date.isoformat()}")
    
    # Add document summaries
    if documents:
        context_parts.append("\nRFP Documents:")
        for doc in documents[:5]:  # Limit to 5 docs
            context_parts.append(f"- {doc.original_filename or doc.filename}")
            if doc.content:
                # First 500 chars of content as summary
                context_parts.append(f"  Summary: {doc.content[:500]}...")
    
    # Add key questions
    if questions:
        context_parts.append(f"\nKey RFP Questions ({len(questions)} total):")
        for q in questions[:10]:  # Top 10 questions
            context_parts.append(f"- {q.text[:200]}")
    
    return "\n".join(context_parts)
