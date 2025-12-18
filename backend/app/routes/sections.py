"""
RFP Sections API Routes
Handles section types, project sections, and content generation.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from app import db
from app.models import (
    RFPSectionType, RFPSection, SectionTemplate,
    Project, User, seed_section_types
)
from app.services.section_generation_service import get_section_generator
from app.services.qdrant_service import QdrantService

bp = Blueprint('sections', __name__, url_prefix='/api')


# ============================================================
# Section Types Endpoints
# ============================================================

@bp.route('/section-types', methods=['GET'])
@jwt_required()
def list_section_types():
    """List all available section types"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get system types and org-specific types
    section_types = RFPSectionType.query.filter(
        db.or_(
            RFPSectionType.is_system == True,
            RFPSectionType.organization_id == user.organization_id
        ),
        RFPSectionType.is_active == True
    ).order_by(RFPSectionType.name).all()
    
    return jsonify({
        'section_types': [st.to_dict() for st in section_types]
    })


@bp.route('/section-types', methods=['POST'])
@jwt_required()
def create_section_type():
    """Create a custom section type for the organization"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name') or not data.get('slug'):
        return jsonify({'error': 'Name and slug are required'}), 400
    
    # Check slug uniqueness
    existing = RFPSectionType.query.filter_by(slug=data['slug']).first()
    if existing:
        return jsonify({'error': 'Slug already exists'}), 400
    
    section_type = RFPSectionType(
        name=data['name'],
        slug=data['slug'],
        description=data.get('description', ''),
        icon=data.get('icon', '📄'),
        default_prompt=data.get('default_prompt', ''),
        required_inputs=data.get('required_inputs', []),
        knowledge_scopes=data.get('knowledge_scopes', []),
        is_system=False,
        organization_id=user.organization_id,
    )
    
    db.session.add(section_type)
    db.session.commit()
    
    return jsonify({
        'message': 'Section type created',
        'section_type': section_type.to_dict()
    }), 201


@bp.route('/section-types/<int:type_id>', methods=['PUT'])
@jwt_required()
def update_section_type(type_id):
    """Update a custom section type"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    section_type = RFPSectionType.query.get(type_id)
    if not section_type:
        return jsonify({'error': 'Section type not found'}), 404
    
    # Can only update non-system types belonging to user's org
    if section_type.is_system:
        return jsonify({'error': 'Cannot modify system section types'}), 403
    if section_type.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        section_type.name = data['name']
    if 'description' in data:
        section_type.description = data['description']
    if 'icon' in data:
        section_type.icon = data['icon']
    if 'default_prompt' in data:
        section_type.default_prompt = data['default_prompt']
    if 'required_inputs' in data:
        section_type.required_inputs = data['required_inputs']
    if 'knowledge_scopes' in data:
        section_type.knowledge_scopes = data['knowledge_scopes']
    if 'is_active' in data:
        section_type.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Section type updated',
        'section_type': section_type.to_dict()
    })


@bp.route('/section-types/<int:type_id>', methods=['DELETE'])
@jwt_required()
def delete_section_type(type_id):
    """Delete a custom section type"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    section_type = RFPSectionType.query.get(type_id)
    if not section_type:
        return jsonify({'error': 'Section type not found'}), 404
    
    if section_type.is_system:
        return jsonify({'error': 'Cannot delete system section types'}), 403
    if section_type.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Soft delete by deactivating
    section_type.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'Section type deleted'})


@bp.route('/section-types/seed', methods=['POST'])
@jwt_required()
def seed_default_section_types():
    """Seed default section types (admin only)"""
    seed_section_types(db.session)
    return jsonify({'message': 'Default section types seeded'})


# ============================================================
# Project Sections Endpoints
# ============================================================

@bp.route('/projects/<int:project_id>/sections', methods=['GET'])
@jwt_required()
def list_project_sections(project_id):
    """List all sections in a project"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    sections = RFPSection.query.filter_by(project_id=project_id)\
        .order_by(RFPSection.order).all()
    
    return jsonify({
        'sections': [s.to_dict() for s in sections],
        'project_id': project_id,
        'total': len(sections)
    })


@bp.route('/projects/<int:project_id>/sections', methods=['POST'])
@jwt_required()
def add_section_to_project(project_id):
    """Add a new section to a project"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if not data.get('section_type_id'):
        return jsonify({'error': 'section_type_id is required'}), 400
    
    section_type = RFPSectionType.query.get(data['section_type_id'])
    if not section_type:
        return jsonify({'error': 'Section type not found'}), 404
    
    # Get next order number
    max_order = db.session.query(db.func.max(RFPSection.order))\
        .filter_by(project_id=project_id).scalar() or 0
    
    section = RFPSection(
        project_id=project_id,
        section_type_id=section_type.id,
        title=data.get('title', section_type.name),
        order=max_order + 1,
        inputs=data.get('inputs', {}),
        ai_generation_params=data.get('ai_generation_params', {}),
    )
    
    db.session.add(section)
    db.session.commit()
    
    return jsonify({
        'message': 'Section added',
        'section': section.to_dict()
    }), 201


@bp.route('/projects/<int:project_id>/sections/<int:section_id>', methods=['GET'])
@jwt_required()
def get_section(project_id, section_id):
    """Get a specific section"""
    section = RFPSection.query.filter_by(id=section_id, project_id=project_id).first()
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    return jsonify({'section': section.to_dict()})


@bp.route('/projects/<int:project_id>/sections/<int:section_id>', methods=['PUT'])
@jwt_required()
def update_section(project_id, section_id):
    """Update a section"""
    user_id = get_jwt_identity()
    
    section = RFPSection.query.filter_by(id=section_id, project_id=project_id).first()
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    data = request.get_json()
    
    if 'title' in data:
        section.title = data['title']
    if 'content' in data:
        section.content = data['content']
        section.version += 1
    if 'inputs' in data:
        section.inputs = data['inputs']
    if 'ai_generation_params' in data:
        section.ai_generation_params = data['ai_generation_params']
    if 'order' in data:
        section.order = data['order']
    if 'status' in data:
        section.status = data['status']
    if 'flags' in data:
        section.flags = data['flags']
    
    section.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'message': 'Section updated',
        'section': section.to_dict()
    })


@bp.route('/projects/<int:project_id>/sections/<int:section_id>', methods=['DELETE'])
@jwt_required()
def delete_section(project_id, section_id):
    """Delete a section from project"""
    section = RFPSection.query.filter_by(id=section_id, project_id=project_id).first()
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    db.session.delete(section)
    db.session.commit()
    
    return jsonify({'message': 'Section deleted'})


@bp.route('/projects/<int:project_id>/sections/reorder', methods=['POST'])
@jwt_required()
def reorder_sections(project_id):
    """Reorder sections in a project"""
    data = request.get_json()
    section_order = data.get('section_order', [])  # List of section IDs in new order
    
    for idx, section_id in enumerate(section_order):
        section = RFPSection.query.filter_by(id=section_id, project_id=project_id).first()
        if section:
            section.order = idx
    
    db.session.commit()
    
    return jsonify({'message': 'Sections reordered'})


# ============================================================
# Section Generation Endpoints
# ============================================================

@bp.route('/sections/<int:section_id>/generate', methods=['POST'])
@jwt_required()
def generate_section_content(section_id):
    """Generate AI content for a section"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    project = section.project
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    section_type = section.section_type
    if not section_type:
        return jsonify({'error': 'Section type not found'}), 404
    
    # Get optional parameters from request
    data = request.get_json() or {}
    inputs = {**section.inputs, **data.get('inputs', {})}
    generation_params = {**section.ai_generation_params, **data.get('generation_params', {})}
    
    # Retrieve context from knowledge base with project dimension filtering
    from app.services.qdrant_service import get_qdrant_service
    qdrant = get_qdrant_service(user.organization_id)
    context = []
    
    # Build search query from inputs
    search_query = ' '.join(str(v) for v in inputs.values() if v)
    if not search_query:
        search_query = section_type.name
    
    # Build dimension filters from project
    dimension_filters = {}
    if project.geography:
        dimension_filters['geography'] = project.geography
    if project.client_type:
        dimension_filters['client_type'] = project.client_type
    if project.industry:
        dimension_filters['industry'] = project.industry
    if project.knowledge_profiles:
        dimension_filters['knowledge_profile_ids'] = [p.id for p in project.knowledge_profiles]
    
    try:
        context = qdrant.search(
            query=search_query, 
            org_id=user.organization_id, 
            limit=5,
            filters=dimension_filters if dimension_filters else None
        )
    except Exception as e:
        print(f"Error retrieving context: {e}")
    
    # Generate content
    generator = get_section_generator()
    result = generator.generate_section_content(
        section_type_slug=section_type.slug,
        prompt_template=section_type.default_prompt or '',
        inputs=inputs,
        context=context,
        generation_params=generation_params,
    )
    
    # Update section
    section.content = result['content']
    section.confidence_score = result['confidence_score']
    section.sources = result['sources']
    section.flags = result['flags']
    section.status = 'generated'
    section.version += 1
    section.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Section content generated',
        'section': section.to_dict(),
        'generation_result': result,
    })


@bp.route('/sections/<int:section_id>/regenerate', methods=['POST'])
@jwt_required()
def regenerate_section(section_id):
    """Regenerate section content with feedback"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    data = request.get_json()
    feedback = data.get('feedback', '')
    
    # Use regenerate with feedback
    generator = get_section_generator()
    from app.services.qdrant_service import get_qdrant_service
    qdrant = get_qdrant_service(user.organization_id)
    project = section.project
    
    # Build dimension filters from project
    dimension_filters = {}
    if project.geography:
        dimension_filters['geography'] = project.geography
    if project.client_type:
        dimension_filters['client_type'] = project.client_type
    if project.industry:
        dimension_filters['industry'] = project.industry
    if project.knowledge_profiles:
        dimension_filters['knowledge_profile_ids'] = [p.id for p in project.knowledge_profiles]
    
    try:
        context = qdrant.search(
            query=section.section_type.name, 
            org_id=user.organization_id, 
            limit=5,
            filters=dimension_filters if dimension_filters else None
        )
    except:
        context = []
    
    result = generator.regenerate_with_feedback(
        original_content=section.content or '',
        feedback=feedback,
        section_type_slug=section.section_type.slug,
        context=context,
    )
    
    section.content = result['content']
    section.confidence_score = result['confidence_score']
    section.sources = result['sources']
    section.flags = result['flags']
    section.version += 1
    section.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Section regenerated',
        'section': section.to_dict(),
    })


@bp.route('/sections/<int:section_id>/review', methods=['POST'])
@jwt_required()
def review_section(section_id):
    """Approve or reject a section"""
    user_id = get_jwt_identity()
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    data = request.get_json()
    action = data.get('action')  # 'approve' or 'reject'
    
    if action == 'approve':
        section.status = 'approved'
        section.reviewed_by = user_id
        section.reviewed_at = datetime.utcnow()
    elif action == 'reject':
        section.status = 'rejected'
        section.reviewed_by = user_id
        section.reviewed_at = datetime.utcnow()
    else:
        return jsonify({'error': 'Invalid action'}), 400
    
    db.session.commit()
    
    return jsonify({
        'message': f'Section {action}d',
        'section': section.to_dict(),
    })


# ============================================================
# Section Templates Endpoints
# ============================================================

@bp.route('/section-templates', methods=['GET'])
@jwt_required()
def list_templates():
    """List section templates"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    section_type_id = request.args.get('section_type_id', type=int)
    
    query = SectionTemplate.query.filter(
        db.or_(
            SectionTemplate.organization_id == None,
            SectionTemplate.organization_id == user.organization_id
        ),
        SectionTemplate.is_active == True
    )
    
    if section_type_id:
        query = query.filter_by(section_type_id=section_type_id)
    
    templates = query.all()
    
    return jsonify({
        'templates': [t.to_dict() for t in templates]
    })


@bp.route('/section-templates', methods=['POST'])
@jwt_required()
def create_template():
    """Create a section template"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    data = request.get_json()
    
    if not data.get('name') or not data.get('content'):
        return jsonify({'error': 'Name and content are required'}), 400
    
    template = SectionTemplate(
        name=data['name'],
        section_type_id=data.get('section_type_id'),
        content=data['content'],
        variables=data.get('variables', []),
        description=data.get('description', ''),
        is_default=data.get('is_default', False),
        organization_id=user.organization_id,
        created_by=user_id,
    )
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify({
        'message': 'Template created',
        'template': template.to_dict()
    }), 201


@bp.route('/section-templates/<int:template_id>/apply', methods=['POST'])
@jwt_required()
def apply_template(template_id):
    """Apply a template to a section"""
    data = request.get_json()
    section_id = data.get('section_id')
    variables = data.get('variables', {})
    
    template = SectionTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    # Render template with variables
    rendered_content = template.render(variables)
    section.content = rendered_content
    section.version += 1
    section.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Template applied',
        'section': section.to_dict(),
    })


@bp.route('/section-templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_template(template_id):
    """Update a section template"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    template = SectionTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    if template.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        template.name = data['name']
    if 'content' in data:
        template.content = data['content']
    if 'variables' in data:
        template.variables = data['variables']
    if 'description' in data:
        template.description = data['description']
    if 'is_default' in data:
        template.is_default = data['is_default']
    if 'section_type_id' in data:
        template.section_type_id = data['section_type_id']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Template updated',
        'template': template.to_dict(),
    })


@bp.route('/section-templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_template(template_id):
    """Delete a section template"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    template = SectionTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    if template.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    template.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'Template deleted'})


# ============================================================
# Proposal Export Endpoints
# ============================================================

@bp.route('/projects/<int:project_id>/export/proposal', methods=['POST'])
@jwt_required()
def export_proposal(project_id):
    """Export full proposal with sections to DOCX"""
    from flask import send_file
    from app.services.export_service import generate_proposal_docx, generate_proposal_xlsx
    from app.models import Question
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    format_type = data.get('format', 'docx')  # docx or xlsx
    include_qa = data.get('include_qa', True)
    
    # Get all approved sections in order
    sections = RFPSection.query.filter_by(project_id=project_id)\
        .order_by(RFPSection.order).all()
    
    # Optionally get questions
    questions = None
    if include_qa:
        questions = Question.query.filter_by(project_id=project_id).all()
    
    if format_type == 'xlsx':
        buffer = generate_proposal_xlsx(project, sections, questions)
        filename = f'{project.name.replace(" ", "_")}_proposal.xlsx'
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    else:
        buffer = generate_proposal_docx(project, sections, include_qa, questions)
        filename = f'{project.name.replace(" ", "_")}_proposal.docx'
        mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype=mimetype
    )


@bp.route('/projects/<int:project_id>/export/preview', methods=['GET'])
@jwt_required()
def export_preview(project_id):
    """Get preview of what will be exported"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    from app.models import Question
    
    sections = RFPSection.query.filter_by(project_id=project_id)\
        .order_by(RFPSection.order).all()
    
    questions = Question.query.filter_by(project_id=project_id).all()
    
    return jsonify({
        'project_name': project.name,
        'sections_count': len(sections),
        'sections_with_content': sum(1 for s in sections if s.content),
        'sections_approved': sum(1 for s in sections if s.status == 'approved'),
        'questions_count': len(questions),
        'questions_answered': sum(1 for q in questions if q.status in ['answered', 'approved']),
        'sections': [
            {
                'id': s.id,
                'title': s.title,
                'type': s.section_type.name if s.section_type else 'Custom',
                'icon': s.section_type.icon if s.section_type else '📄',
                'status': s.status,
                'has_content': bool(s.content),
                'word_count': len(s.content.split()) if s.content else 0,
            }
            for s in sections
        ],
    })

