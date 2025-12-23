"""
PPT Routes - API endpoints for PowerPoint generation
"""
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Project, RFPSection, Question, User
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('ppt', __name__)


@bp.route('/generate/<int:project_id>', methods=['POST'])
@jwt_required()
def generate_ppt(project_id):
    """
    Generate a PowerPoint presentation for a project.
    
    Request body (optional):
    {
        "style": "modern" | "minimal" | "corporate" | "startup",
        "branding": {
            "primary_color": "#4B0082",
            "secondary_color": "#6366F1"
        }
    }
    """
    from ..agents.ppt_generator_agent import PPTGeneratorAgent
    from ..services.ppt_service import PPTService
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get request options
    data = request.get_json() or {}
    style = data.get('style', 'corporate')
    branding = data.get('branding', {})
    
    # Get organization for vendor profile
    organization = project.organization
    vendor_profile = {}
    if organization and hasattr(organization, 'settings') and organization.settings:
        vendor_profile = organization.settings.get('vendor_profile', {})
        vendor_profile['company_name'] = organization.name
    
    # Get project sections
    sections = RFPSection.query.filter_by(project_id=project_id).order_by(RFPSection.order).all()
    sections_data = [s.to_dict() for s in sections]
    
    # Get questions if any
    questions = Question.query.filter_by(project_id=project_id).all()
    questions_data = [{'text': q.text, 'status': q.status, 'section': q.section} for q in questions]
    
    # Build project data
    project_data = {
        'id': project.id,
        'name': project.name,
        'client_name': project.client_name or 'Client',
        'industry': project.industry or '',
        'deadline': project.due_date.isoformat() if project.due_date else '',
        'created_at': project.created_at.isoformat() if project.created_at else '',
        'status': project.status,
    }
    
    logger.info(f"Generating PPT for project {project_id}: {project.name}")
    
    try:
        # Step 1: Generate slide content with AI
        agent = PPTGeneratorAgent(org_id=user.organization_id)
        content_result = agent.generate_ppt_content(
            project_data=project_data,
            sections=sections_data,
            questions=questions_data,
            vendor_profile=vendor_profile,
            style=style,
            branding=branding
        )
        
        if not content_result.get('success'):
            return jsonify({
                'error': 'Failed to generate slide content',
                'details': content_result.get('error', 'Unknown error')
            }), 500
        
        slides = content_result.get('slides', [])
        
        if not slides:
            return jsonify({'error': 'No slides generated'}), 500
        
        # Extract diagram data from sections and inject into architecture slides
        diagram_data = None
        for section in sections:
            if section.inputs and 'diagram_data' in section.inputs:
                diagram_data = section.inputs['diagram_data']
                break
        
        # Also try to extract mermaid code from section content  
        if not diagram_data:
            for section in sections:
                if section.content and '```mermaid' in section.content:
                    import re
                    mermaid_match = re.search(r'```mermaid\n(.*?)\n```', section.content, re.DOTALL)
                    if mermaid_match:
                        diagram_data = {'mermaid_code': mermaid_match.group(1)}
                        break
        
        # Inject mermaid code into architecture slides
        if diagram_data:
            for slide in slides:
                if slide.get('slide_type') == 'architecture':
                    slide['mermaid_code'] = diagram_data.get('mermaid_code', '')
                    logger.info("Injected mermaid code into architecture slide")
        
        # Step 2: Generate PPTX file
        ppt_service = PPTService(branding=branding)
        pptx_buffer = ppt_service.generate_pptx(
            slides_data=slides,
            title=project.name,
            client_name=project.client_name or 'Client',
            company_name=vendor_profile.get('company_name', organization.name if organization else 'Company')
        )
        
        # Generate filename
        filename = f"{project.name.replace(' ', '_')}_Proposal.pptx"
        
        logger.info(f"PPT generated successfully with {len(slides)} slides")
        
        return send_file(
            pptx_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"PPT generation error: {str(e)}")
        return jsonify({
            'error': 'PPT generation failed',
            'details': str(e)
        }), 500


@bp.route('/preview/<int:project_id>', methods=['GET'])
@jwt_required()
def preview_ppt(project_id):
    """
    Get a preview of what the PPT will contain (slide structure without generating file).
    """
    from ..agents.ppt_generator_agent import PPTGeneratorAgent
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get sections count
    sections = RFPSection.query.filter_by(project_id=project_id).all()
    sections_with_content = [s for s in sections if s.content]
    
    # Get questions count
    questions = Question.query.filter_by(project_id=project_id).all()
    answered_questions = [q for q in questions if q.status in ['answered', 'approved']]
    
    return jsonify({
        'project_name': project.name,
        'client_name': project.client_name,
        'sections_count': len(sections),
        'sections_with_content': len(sections_with_content),
        'questions_count': len(questions),
        'questions_answered': len(answered_questions),
        'estimated_slides': 15 + len(sections_with_content),  # Base slides + sections
        'available_styles': ['modern', 'minimal', 'corporate', 'startup'],
    })


@bp.route('/styles', methods=['GET'])
@jwt_required()
def get_styles():
    """Get available PPT styles."""
    return jsonify({
        'styles': [
            {
                'id': 'modern',
                'name': 'Modern',
                'description': 'Clean design with bold headlines and minimal text'
            },
            {
                'id': 'minimal',
                'name': 'Minimal',
                'description': 'Extremely minimal with lots of white space'
            },
            {
                'id': 'corporate',
                'name': 'Corporate',
                'description': 'Traditional business presentation style'
            },
            {
                'id': 'startup',
                'name': 'Startup',
                'description': 'Energetic and dynamic with focus on innovation'
            }
        ]
    })
