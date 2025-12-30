"""
RFP Sections API Routes
Handles section types, project sections, and content generation.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from app import db
from app.models import (
    RFPSectionType, RFPSection, SectionTemplate,
    Project, User, seed_section_types,
    SectionVersion, save_section_version
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
    user_id = int(get_jwt_identity())
    
    section = RFPSection.query.filter_by(id=section_id, project_id=project_id).first()
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    data = request.get_json()
    
    # Save version history BEFORE content changes
    content_changing = 'content' in data and data['content'] != section.content
    if content_changing:
        save_section_version(
            section=section,
            user_id=user_id,
            change_type='edit',
            change_summary='Manual content edit'
        )
    
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
    
    # Workflow fields
    if 'assigned_to' in data:
        section.assigned_to = data['assigned_to']
    if 'due_date' in data:
        from datetime import datetime as dt
        section.due_date = dt.fromisoformat(data['due_date']) if data['due_date'] else None
    if 'priority' in data:
        section.priority = data['priority']
    
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


@bp.route('/sections/<int:section_id>/comments', methods=['POST'])
@jwt_required()
def add_section_comment(section_id):
    """Add a comment to a section"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    if section.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({'error': 'Comment text is required'}), 400
    
    # Create comment object
    comment = {
        'id': len(section.comments or []) + 1,
        'user_id': user_id,
        'user_name': user.name,
        'text': text,
        'created_at': datetime.utcnow().isoformat(),
    }
    
    # Add to comments array - IMPORTANT: make a copy to ensure SQLAlchemy detects the change
    from sqlalchemy.orm.attributes import flag_modified
    comments = list(section.comments or [])  # Make a copy, not reference
    comments.append(comment)
    section.comments = comments
    flag_modified(section, 'comments')  # Force SQLAlchemy to detect JSON change
    section.updated_at = datetime.utcnow()
    
    # --- Create notifications for relevant users ---
    from app.models import Notification
    
    # Get users to notify: admins, reviewers, and section assignee
    users_to_notify = set()
    
    # Notify admins and reviewers in the organization
    admin_reviewers = User.query.filter(
        User.organization_id == user.organization_id,
        User.role.in_(['admin', 'reviewer'])
    ).all()
    for u in admin_reviewers:
        if u.id != user_id:  # Don't notify yourself
            users_to_notify.add(u.id)
    
    # Notify section assignee if different from commenter
    if section.assigned_to and section.assigned_to != user_id:
        users_to_notify.add(section.assigned_to)
    
    # Create notifications
    project = section.project
    section_title = section.title or section.section_type.name
    
    for notify_user_id in users_to_notify:
        notification = Notification(
            user_id=notify_user_id,
            actor_id=user_id,
            type='comment',
            entity_type='section',
            entity_id=section_id,
            title=f'New comment on "{section_title}"',
            message=f'{user.name} commented: "{text[:80]}{"..." if len(text) > 80 else ""}"',
            link=f'/projects/{project.id}/proposal'
        )
        db.session.add(notification)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Comment added',
        'comment': comment,
        'comments': section.comments,
        'notifications_sent': len(users_to_notify)
    }), 201


@bp.route('/sections/<int:section_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_section_comment(section_id, comment_id):
    """Delete a comment from a section"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    if section.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Find and remove comment
    comments = section.comments or []
    original_len = len(comments)
    comments = [c for c in comments if c.get('id') != comment_id]
    
    if len(comments) == original_len:
        return jsonify({'error': 'Comment not found'}), 404
    
    section.comments = comments
    section.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Comment deleted',
        'comments': section.comments,
    })


# ============================================================
# Section History Endpoints
# ============================================================

@bp.route('/sections/<int:section_id>/history', methods=['GET'])
@jwt_required()
def get_section_history(section_id):
    """Get version history for a section"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    if section.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get all versions for this section
    versions = SectionVersion.query.filter_by(section_id=section_id)\
        .order_by(SectionVersion.version_number.desc()).all()
    
    return jsonify({
        'section_id': section_id,
        'current_version': section.version,
        'history': [v.to_dict() for v in versions],
        'total': len(versions)
    })


@bp.route('/sections/<int:section_id>/restore/<int:version_number>', methods=['POST'])
@jwt_required()
def restore_section_version(section_id, version_number):
    """Restore a section to a previous version"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    if section.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Find the version to restore
    version = SectionVersion.query.filter_by(
        section_id=section_id, 
        version_number=version_number
    ).first()
    
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    # Save current state before restoring
    save_section_version(
        section=section,
        user_id=user_id,
        change_type='restore',
        change_summary=f'Before restoring to version {version_number}'
    )
    
    # Restore the section
    section.content = version.content
    section.title = version.title or section.title
    section.status = version.status or section.status
    section.confidence_score = version.confidence_score
    section.version += 1
    section.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': f'Restored to version {version_number}',
        'section': section.to_dict()
    })


# ============================================================
# Section Generation Endpoints
# ============================================================

@bp.route('/sections/chat', methods=['POST'])
@jwt_required()
def chat_for_section():
    """Chat with AI for section content generation"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    project_id = data.get('project_id')
    section_type_id = data.get('section_type_id')
    message = data.get('message', '')
    knowledge_item_ids = data.get('knowledge_item_ids', [])
    conversation_history = data.get('conversation_history', [])
    
    if not project_id or not message:
        return jsonify({'error': 'project_id and message are required'}), 400
    
    # Get project for context
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get section type if provided
    section_type = None
    if section_type_id:
        section_type = RFPSectionType.query.get(section_type_id)
    
    # Retrieve knowledge context
    from app.services.qdrant_service import get_qdrant_service
    from app.models import KnowledgeItem
    
    qdrant = get_qdrant_service(user.organization_id)
    context = []
    sources = []
    
    # Get selected knowledge items first
    if knowledge_item_ids:
        knowledge_items = KnowledgeItem.query.filter(
            KnowledgeItem.id.in_(knowledge_item_ids),
            KnowledgeItem.organization_id == user.organization_id
        ).all()
        for item in knowledge_items:
            context.append({
                'content': item.content or '',
                'metadata': {'title': item.title, 'id': item.id}
            })
            sources.append({'title': item.title, 'snippet': (item.content or '')[:200]})
    
    # Also search for relevant context
    try:
        # Build dimension filters from project
        dimension_filters = {}
        if project.knowledge_profiles:
            dimension_filters['knowledge_profile_ids'] = [p.id for p in project.knowledge_profiles]
        
        search_results = qdrant.search(
            query=message,
            org_id=user.organization_id,
            limit=5,
            filters=dimension_filters if dimension_filters else None
        )
        for result in search_results:
            if result not in context:
                context.append(result)
                if 'metadata' in result and 'title' in result['metadata']:
                    sources.append({
                        'title': result['metadata']['title'],
                        'snippet': result.get('content', '')[:200]
                    })
    except Exception as e:
        print(f"Error searching knowledge: {e}")
    
    # Build the prompt for the AI
    generator = get_section_generator(org_id=user.organization_id)
    
    # Build system context
    system_context = f"""You are an AI assistant helping to create proposal content.
Project: {project.name}
Client: {project.client_name or 'Not specified'}
"""
    
    if section_type:
        system_context += f"Section Type: {section_type.name}\n"
        system_context += f"Section Description: {section_type.description or ''}\n"
    
    # Add knowledge context
    if context:
        system_context += "\nRelevant Knowledge Base Content:\n"
        for i, ctx in enumerate(context[:5], 1):
            content = ctx.get('content', '')[:500]
            title = ctx.get('metadata', {}).get('title', f'Source {i}')
            system_context += f"\n[{title}]\n{content}\n"
    
    # Build messages for the AI
    messages = [{"role": "system", "content": system_context}]
    
    # Add conversation history
    for msg in conversation_history:
        messages.append(msg)
    
    # Add current message
    messages.append({"role": "user", "content": message})
    
    # Generate response using the section generator
    try:
        response = generator.chat(messages)
        
        # Check if user asked for content generation
        is_generation_request = any(keyword in message.lower() for keyword in [
            'generate', 'create', 'write', 'draft', 'produce', 'make'
        ])
        
        return jsonify({
            'response': response,
            'sources': sources[:5],
            'suggested_content': response if is_generation_request else None,
        })
    except Exception as e:
        print(f"Error in chat: {e}")
        return jsonify({'error': f'AI error: {str(e)}'}), 500


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
    
    # Special handling for diagram section types
    if section_type.template_type == 'diagram':
        return generate_diagram_section(section, project, user)
    
    # Retrieve context from knowledge base with project dimension filtering
    from app.services.qdrant_service import get_qdrant_service
    from app.models import KnowledgeItem
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
        print(f"[SOURCES DEBUG] Qdrant search returned {len(context)} results")
        for c in context:
            print(f"[SOURCES DEBUG]   - {c.get('title', 'Unknown')}: score={c.get('score', 0)}")
    except Exception as e:
        print(f"[SOURCES DEBUG] Qdrant search failed: {e}")
        # Fallback: Smart keyword-based search with calculated relevance
        try:
            from sqlalchemy import or_, func
            
            # Get ALL knowledge items for this organization (we'll score and rank them)
            all_items = KnowledgeItem.query.filter_by(
                organization_id=user.organization_id
            ).all()
            
            if not all_items:
                print("[SOURCES DEBUG] No knowledge items found in database")
            else:
                # Build search terms from section type, title, and search query
                search_terms = set()
                # From section type name (e.g., "Functional Requirements" -> ["functional", "requirements"])
                for word in section_type.name.lower().split():
                    if len(word) > 2:
                        search_terms.add(word)
                # From section type slug (e.g., "functional_requirements")
                for word in section_type.slug.replace('_', ' ').split():
                    if len(word) > 2:
                        search_terms.add(word)
                # From search query
                for word in search_query.lower().split():
                    if len(word) > 3:  # Slightly longer for query terms
                        search_terms.add(word)
                
                print(f"[SOURCES DEBUG] Section '{section_type.name}' search terms: {search_terms}")
                
                # Score each knowledge item based on keyword matches
                scored_items = []
                for item in all_items:
                    title_lower = (item.title or '').lower()
                    content_lower = (item.content or '')[:2000].lower()  # First 2000 chars
                    
                    # Calculate relevance score based on matches
                    score = 0.0
                    matches = 0
                    for term in search_terms:
                        # Title matches are worth more
                        if term in title_lower:
                            score += 0.15
                            matches += 1
                        # Content matches
                        term_count = content_lower.count(term)
                        if term_count > 0:
                            score += min(0.05 * term_count, 0.2)  # Cap at 0.2 per term
                            matches += 1
                    
                    # Normalize score based on number of search terms
                    if len(search_terms) > 0:
                        score = score / len(search_terms)
                    
                    # Only include items with some relevance
                    if score > 0.05:
                        scored_items.append({
                            'item': item,
                            'score': min(score, 0.95),  # Cap at 95%
                            'matches': matches
                        })
                
                # Sort by score (highest first) and take top 5
                scored_items.sort(key=lambda x: x['score'], reverse=True)
                
                print(f"[SOURCES DEBUG] Found {len(scored_items)} relevant items for '{section_type.name}'")
                for si in scored_items:  # Return all relevant sources, not limited to 5
                    print(f"[SOURCES DEBUG]   - {si['item'].title}: score={si['score']:.2f}, matches={si['matches']}")
                    context.append({
                        'item_id': si['item'].id,
                        'title': si['item'].title,
                        'content_preview': (si['item'].content or '')[:500],
                        'score': round(si['score'], 2),
                    })
                
                # If no scored items, fall back to first 5 with low score
                if not scored_items:
                    print("[SOURCES DEBUG] No relevant matches, using generic fallback")
                    for item in all_items[:5]:
                        context.append({
                            'item_id': item.id,
                            'title': item.title,
                            'content_preview': (item.content or '')[:500],
                            'score': 0.2,  # Low score indicating no specific match
                        })
        except Exception as e2:
            print(f"[SOURCES DEBUG] Fallback also failed: {e2}")
    
    # Generate content
    generator = get_section_generator(org_id=user.organization_id)
    result = generator.generate_section_content(
        section_type_slug=section_type.slug,
        prompt_template=section_type.default_prompt or '',
        inputs=inputs,
        context=context,
        generation_params=generation_params,
    )
    
    # Post-process: Replace common placeholders with actual values
    content = result['content']
    
    # Get company name from organization
    organization = user.organization
    company_name = organization.name if organization else 'Our Company'
    
    # Get vendor profile for additional company info
    vendor_profile = {}
    if organization and hasattr(organization, 'settings') and organization.settings:
        vendor_profile = organization.settings.get('vendor_profile', {})
        if vendor_profile.get('company_name'):
            company_name = vendor_profile['company_name']
    
    # Replace common placeholders
    placeholder_replacements = {
        # Company name variations
        '[Company Name]': company_name,
        '[company name]': company_name,
        '[COMPANY NAME]': company_name,
        '[Your Company Name]': company_name,
        '[Your Company]': company_name,
        '[Our Company]': company_name,
        '[Our Company Name]': company_name,
        '[Vendor Name]': company_name,
        '{{company_name}}': company_name,
        '{{Company_Name}}': company_name,
        '{{organization_name}}': company_name,
        # Client/Project name variations
        '[Client Name]': project.client_name or project.name or 'the client',
        '[CLIENT NAME]': project.client_name or project.name or 'the client',
        '[Client Contact Name]': project.client_name or 'the client representative',
        '[Client Contact Name/Client Name]': project.client_name or project.name or 'the client',
        '[Project Name]': project.name or 'this project',
        '[PROJECT NAME]': project.name or 'this project',
        '{{project_name}}': project.name or 'this project',
        '{{Project_Name}}': project.name or 'this project',
        # RFP references
        '[RFP Title/Number]': project.name or 'this RFP',
        '[RFP Title]': project.name or 'this RFP',
        '[RFP Number]': project.name or 'this RFP',
        '{{rfp_title}}': project.name or 'this RFP',
        # Vendor profile info
        '[Your Industry/Core Expertise]': vendor_profile.get('industry', 'technology solutions'),
        '[Your Title]': 'Proposal Manager',
        '[Your Name]': vendor_profile.get('contact_name', 'The Proposal Team'),
        '[Number]': str(vendor_profile.get('years_in_business', '10+')),
        '{{years_in_business}}': str(vendor_profile.get('years_in_business', '10+')),
        # Date placeholder
        '{{current_date}}': datetime.utcnow().strftime('%B %d, %Y'),
    }
    
    for placeholder, value in placeholder_replacements.items():
        content = content.replace(placeholder, value)
    
    # Comprehensive regex-based cleanup for remaining placeholders
    import re
    
    # Remove instruction-like brackets [briefly mention...], [e.g., ...]
    content = re.sub(r'\[briefly\s+[^\]]+\]', '', content)
    content = re.sub(r'\[mention\s+[^\]]+\]', '', content)
    content = re.sub(r'\[e\.g\.,?\s*[^\]]+\]', '', content)
    content = re.sub(r'\[insert\s+[^\]]+\]', '', content, flags=re.IGNORECASE)
    content = re.sub(r'\[add\s+[^\]]+\]', '', content, flags=re.IGNORECASE)
    content = re.sub(r'\[include\s+[^\]]+\]', '', content, flags=re.IGNORECASE)
    
    # Replace remaining {{...}} template variables with empty or generic text
    content = re.sub(r'\{\{[^}]+\}\}', '', content)
    
    # Replace remaining [Something Name] patterns that look like placeholders
    content = re.sub(r'\[Your [^\]]+\]', company_name, content)
    content = re.sub(r'\[Our [^\]]+\]', company_name, content)
    
    result['content'] = content


    
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


def generate_diagram_section(section, project, user):
    """Generate a diagram section using DiagramGeneratorAgent"""
    from app.agents import DiagramGeneratorAgent
    from app.models import Document
    
    # Get RFP document text from project
    documents = Document.query.filter_by(project_id=project.id).all()
    
    if not documents:
        return jsonify({'error': 'No documents found for this project. Please upload an RFP document first.'}), 400
    
    # Combine document text
    document_text = ""
    for doc in documents:
        if doc.extracted_text:
            document_text += doc.extracted_text + "\n\n"
    
    if not document_text.strip():
        return jsonify({'error': 'No text content found in project documents. Please ensure documents have been processed.'}), 400
    
    # Generate diagram
    agent = DiagramGeneratorAgent(org_id=user.organization_id)
    result = agent.generate_diagram(document_text, diagram_type='architecture')
    
    if not result.get('success'):
        return jsonify({'error': result.get('error', 'Failed to generate diagram')}), 500
    
    diagram = result.get('diagram', {})
    
    # Extract values to avoid backslash in f-string
    description = diagram.get('description', 'System architecture for the proposed solution.')
    mermaid_code = diagram.get('mermaid_code', 'flowchart TB\n    A[System] --> B[Component]')
    notes = diagram.get('notes', 'The architecture diagram above shows the key components of the proposed solution and how they interact with each other.')
    
    # Build section content with mermaid diagram and explanation
    content = f"""## Architecture Overview

{description}

## System Architecture Diagram

```mermaid
{mermaid_code}
```

## Component Descriptions

{notes}

## Key Components

"""
    # Add components if available
    components = diagram.get('components', [])
    for comp in components:
        content += f"- **{comp}**\n"
    
    # Update section
    section.content = content
    section.confidence_score = 0.85
    section.sources = [{'type': 'ai_generated', 'title': 'DiagramGeneratorAgent'}]
    section.flags = []
    section.status = 'generated'
    section.version += 1
    section.updated_at = datetime.utcnow()
    
    # Store diagram metadata in inputs for later use
    section.inputs = {
        **section.inputs,
        'diagram_data': {
            'mermaid_code': diagram.get('mermaid_code', ''),
            'title': diagram.get('title', ''),
            'description': diagram.get('description', ''),
        }
    }
    
    db.session.commit()
    
    return jsonify({
        'message': 'Architecture diagram generated',
        'section': section.to_dict(),
        'generation_result': {
            'content': content,
            'diagram': diagram,
            'confidence_score': 0.85,
        },
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
    generator = get_section_generator(org_id=user.organization_id)
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
    
    context = []
    try:
        context = qdrant.search(
            query=section.section_type.name, 
            org_id=user.organization_id, 
            limit=5,
            filters=dimension_filters if dimension_filters else None
        )
        print(f"[SOURCES DEBUG] Regenerate: Qdrant returned {len(context)} results")
    except Exception as e:
        print(f"[SOURCES DEBUG] Regenerate: Qdrant search failed: {e}")
        # Fallback: Smart keyword-based search with calculated relevance
        try:
            from app.models import KnowledgeItem
            
            section_type = section.section_type
            
            # Get ALL knowledge items for this organization
            all_items = KnowledgeItem.query.filter_by(
                organization_id=user.organization_id
            ).all()
            
            if all_items:
                # Build search terms from section type
                search_terms = set()
                for word in section_type.name.lower().split():
                    if len(word) > 2:
                        search_terms.add(word)
                for word in section_type.slug.replace('_', ' ').split():
                    if len(word) > 2:
                        search_terms.add(word)
                
                print(f"[SOURCES DEBUG] Regenerate: Section '{section_type.name}' search terms: {search_terms}")
                
                # Score each item
                scored_items = []
                for item in all_items:
                    title_lower = (item.title or '').lower()
                    content_lower = (item.content or '')[:2000].lower()
                    
                    score = 0.0
                    matches = 0
                    for term in search_terms:
                        if term in title_lower:
                            score += 0.15
                            matches += 1
                        term_count = content_lower.count(term)
                        if term_count > 0:
                            score += min(0.05 * term_count, 0.2)
                            matches += 1
                    
                    if len(search_terms) > 0:
                        score = score / len(search_terms)
                    
                    if score > 0.05:
                        scored_items.append({
                            'item': item,
                            'score': min(score, 0.95),
                            'matches': matches
                        })
                
                scored_items.sort(key=lambda x: x['score'], reverse=True)
                
                print(f"[SOURCES DEBUG] Regenerate: Found {len(scored_items)} relevant items for '{section_type.name}'")
                for si in scored_items:  # Return all relevant sources, not limited to 5
                    print(f"[SOURCES DEBUG]   - {si['item'].title}: score={si['score']:.2f}")
                    context.append({
                        'item_id': si['item'].id,
                        'title': si['item'].title,
                        'content_preview': (si['item'].content or '')[:500],
                        'score': round(si['score'], 2),
                    })
                
                if not scored_items:
                    for item in all_items[:5]:
                        context.append({
                            'item_id': item.id,
                            'title': item.title,
                            'content_preview': (item.content or '')[:500],
                            'score': 0.2,
                        })
        except Exception as e2:
            print(f"[SOURCES DEBUG] Regenerate: Fallback failed: {e2}")
    
    result = generator.regenerate_with_feedback(
        original_content=section.content or '',
        feedback=feedback,
        section_type_slug=section.section_type.slug,
        context=context,
    )
    
    # Post-process: Replace common placeholders with actual values
    content = result['content']
    organization = user.organization
    company_name = organization.name if organization else 'Our Company'
    
    # Get vendor profile for additional company info
    if organization and hasattr(organization, 'settings') and organization.settings:
        vendor_profile = organization.settings.get('vendor_profile', {})
        if vendor_profile.get('company_name'):
            company_name = vendor_profile['company_name']
    
    # Replace common placeholders
    placeholder_replacements = {
        '[Company Name]': company_name,
        '[company name]': company_name,
        '[COMPANY NAME]': company_name,
        '{{company_name}}': company_name,
        '[Your Company]': company_name,
        '[Our Company]': company_name,
        '[Vendor Name]': company_name,
        '[Client Name]': project.client_name or 'the client',
        '[CLIENT NAME]': project.client_name or 'the client',
        '[Project Name]': project.name or 'this project',
    }
    
    for placeholder, value in placeholder_replacements.items():
        content = content.replace(placeholder, value)
    
    result['content'] = content
    
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
        # Check for default DOCX template
        import os
        from app.models import ExportTemplate
        template_path = None
        template = ExportTemplate.query.filter_by(
            organization_id=user.organization_id,
            template_type='docx',
            is_default=True
        ).first()
        if template and os.path.exists(template.file_path):
            template_path = template.file_path
        
        # Pass organization and template for vendor visibility section
        buffer = generate_proposal_docx(project, sections, include_qa, questions, project.organization, template_path)
        filename = f'{project.name.replace(" ", "_")}_proposal.docx'
        mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    # Optionally upload to GCP if configured
    try:
        from app.services.storage_service import get_storage_service
        storage = get_storage_service()
        
        if storage.storage_type == 'gcp':
            rfp_proposal_prefix = os.environ.get('GCP_RFP_PROPOSAL_PREFIX', 'rfp_proposal')
            project_subfolder = f"project_{project_id}"
            
            # Upload to GCP
            buffer.seek(0)
            storage_metadata = storage.provider.upload_with_path(
                file=buffer,
                original_filename=filename,
                prefix=rfp_proposal_prefix,
                subfolder=project_subfolder,
                content_type=mimetype,
                metadata={
                    'project_id': project_id,
                    'exported_by': user_id,
                    'organization_id': user.organization_id,
                    'export_type': format_type
                }
            )
            current_app.logger.info(f"Proposal exported to GCP: {storage_metadata.file_url}")
            
            # Reset buffer position for download
            buffer.seek(0)
    except Exception as e:
        current_app.logger.warning(f"Failed to upload proposal to GCP, still serving file: {e}")
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype=mimetype
    )


@bp.route('/projects/<int:project_id>/export/proposal-preview', methods=['POST'])
@jwt_required()
def export_proposal_preview(project_id):
    """Generate proposal and return preview URL for iframe viewing"""
    import os
    from app.services.export_service import generate_proposal_docx
    from app.models import Question
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get all sections in order
    sections = RFPSection.query.filter_by(project_id=project_id)\
        .order_by(RFPSection.order).all()
    
    # Get questions
    questions = Question.query.filter_by(project_id=project_id).all()
    
    # Check for default DOCX template
    from app.models import ExportTemplate
    template_path = None
    template = ExportTemplate.query.filter_by(
        organization_id=user.organization_id,
        template_type='docx',
        is_default=True
    ).first()
    if template and os.path.exists(template.file_path):
        template_path = template.file_path
    
    # Generate the DOCX
    buffer = generate_proposal_docx(project, sections, True, questions, project.organization, template_path)
    filename = f'{project.name.replace(" ", "_")}_proposal.docx'
    mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    # Try to upload to GCP and get signed URL
    preview_url = None
    try:
        from app.services.storage_service import get_storage_service
        storage = get_storage_service()
        
        if storage.storage_type == 'gcp':
            rfp_proposal_prefix = os.environ.get('GCP_RFP_PROPOSAL_PREFIX', 'rfp_proposal')
            project_subfolder = f"project_{project_id}/preview"
            
            # Upload to GCP
            buffer.seek(0)
            storage_metadata = storage.provider.upload_with_path(
                file=buffer,
                original_filename=filename,
                prefix=rfp_proposal_prefix,
                subfolder=project_subfolder,
                content_type=mimetype,
                metadata={
                    'project_id': project_id,
                    'exported_by': user_id,
                    'organization_id': user.organization_id,
                    'export_type': 'preview'
                }
            )
            
            # Get signed URL for viewing (1 hour expiry)
            file_id = storage_metadata.file_id
            preview_url = storage.provider.get_url(file_id, expiry_minutes=60)
            current_app.logger.info(f"Proposal preview uploaded to GCP, signed URL generated: {file_id}")
    except Exception as e:
        current_app.logger.warning(f"Failed to upload proposal preview to GCP: {e}")
    
    return jsonify({
        'success': True,
        'preview_url': preview_url,
        'filename': filename,
        'sections_count': len(sections),
        'project_name': project.name
    })


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


# ============================================================
# Q&A to Section Bridge Endpoints (NEW)
# ============================================================

@bp.route('/projects/<int:project_id>/sections/populate-from-qa', methods=['POST'])
@jwt_required()
def populate_sections_from_qa(project_id):
    """
    Populate proposal sections with Q&A answers.
    
    This bridges the gap between the Q&A workflow and Proposal Builder.
    Maps approved Q&A answers to relevant proposal sections.
    
    Request body (optional):
    {
        "create_qa_section": true,  // Create Q&A Responses section if missing
        "inject_into_sections": true,  // Inject Q&A context into narrative sections
        "use_ai_mapping": false  // Use AI for intelligent mapping (slower)
    }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    create_qa_section = data.get('create_qa_section', True)
    inject_into_sections = data.get('inject_into_sections', False)
    use_ai_mapping = data.get('use_ai_mapping', False)
    
    from app.services.qa_section_bridge_service import get_qa_section_bridge_service
    bridge_service = get_qa_section_bridge_service()
    
    result = {
        'project_id': project_id,
        'qa_section': None,
        'sections_updated': [],
        'mapping': {}
    }
    
    # 1. Populate Q&A Responses section
    if create_qa_section:
        qa_section = bridge_service.populate_qa_responses_section(
            project_id, 
            create_if_missing=True
        )
        if qa_section:
            result['qa_section'] = qa_section.to_dict()
    
    # 2. Get Q&A-to-section mapping
    mapping = bridge_service.map_answers_to_sections(
        project_id, 
        use_ai_mapping=use_ai_mapping
    )
    result['mapping'] = {
        slug: len(answers) for slug, answers in mapping.items()
    }
    
    # 3. Inject Q&A context into narrative sections
    if inject_into_sections:
        existing_sections = RFPSection.query.filter_by(project_id=project_id).all()
        for section in existing_sections:
            if section.section_type and section.section_type.slug != 'qa_responses':
                section_slug = section.section_type.slug
                relevant_answers = mapping.get(section_slug, [])
                if relevant_answers:
                    inject_result = bridge_service.inject_qa_context_into_section(
                        section.id, 
                        qa_answers=relevant_answers
                    )
                    if inject_result.get('success') and inject_result.get('count', 0) > 0:
                        result['sections_updated'].append({
                            'section_id': section.id,
                            'section_title': section.title,
                            'qa_count': inject_result['count']
                        })
    
    return jsonify({
        'success': True,
        'message': f"Populated {len(result.get('sections_updated', []))} sections with Q&A content",
        **result
    })


@bp.route('/projects/<int:project_id>/sections/qa-mapping-preview', methods=['GET'])
@jwt_required()
def preview_qa_section_mapping(project_id):
    """
    Preview how Q&A answers would map to proposal sections.
    
    Returns a preview without making any changes.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    from app.services.qa_section_bridge_service import get_qa_section_bridge_service
    bridge_service = get_qa_section_bridge_service()
    
    preview = bridge_service.get_section_qa_mapping_preview(project_id)
    
    return jsonify({
        'success': True,
        'preview': preview
    })


@bp.route('/sections/<int:section_id>/inject-qa', methods=['POST'])
@jwt_required()
def inject_qa_into_section(section_id):
    """
    Inject relevant Q&A answers into a specific section.
    
    Request body (optional):
    {
        "question_ids": [1, 2, 3]  // Specific questions to inject (optional)
    }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    section = RFPSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Section not found'}), 404
    
    if section.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    question_ids = data.get('question_ids')
    
    from app.services.qa_section_bridge_service import get_qa_section_bridge_service
    bridge_service = get_qa_section_bridge_service()
    
    # If specific question IDs provided, filter answers
    qa_answers = None
    if question_ids:
        all_qa = bridge_service.get_project_qa_answers(section.project_id)
        qa_answers = [qa for qa in all_qa if qa['question_id'] in question_ids]
    
    result = bridge_service.inject_qa_context_into_section(
        section_id,
        qa_answers=qa_answers
    )
    
    # Refresh section
    db.session.refresh(section)
    
    return jsonify({
        **result,
        'section': section.to_dict() if result.get('success') else None
    })


@bp.route('/projects/<int:project_id>/sections/populate-qa-section', methods=['POST'])
@jwt_required()
def create_qa_responses_section(project_id):
    """
    Create or update the Q&A Responses section with all approved answers.
    
    This creates a formatted section containing all Q&A from the project.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    from app.services.qa_section_bridge_service import get_qa_section_bridge_service
    bridge_service = get_qa_section_bridge_service()
    
    qa_section = bridge_service.populate_qa_responses_section(
        project_id,
        create_if_missing=True
    )
    
    if qa_section:
        return jsonify({
            'success': True,
            'message': 'Q&A Responses section populated',
            'section': qa_section.to_dict()
        })
    else:
        return jsonify({
            'success': False,
            'message': 'No Q&A answers found to populate'
        })

