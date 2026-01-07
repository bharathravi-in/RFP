from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from io import BytesIO
from ..extensions import db
from ..models import Project, Question, User

bp = Blueprint('export', __name__)


@bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_export():
    """Preview export content."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get approved questions with answers
    questions = Question.query.filter_by(
        project_id=project_id
    ).order_by(Question.order).all()
    
    preview_data = []
    for q in questions:
        answer = q.current_answer
        preview_data.append({
            'section': q.section,
            'question': q.text,
            'answer': answer.content if answer else '',
            'status': q.status,
            'confidence': answer.confidence_score if answer else 0
        })
    
    return jsonify({
        'project_name': project.name,
        'total_questions': len(questions),
        'answered': sum(1 for q in questions if q.current_answer),
        'approved': sum(1 for q in questions if q.status == 'approved'),
        'content': preview_data
    }), 200


@bp.route('/docx', methods=['POST'])
@jwt_required()
def export_docx():
    """Export project as DOCX."""
    from ..services.export_service import generate_docx
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get questions
    questions = Question.query.filter_by(
        project_id=project_id
    ).order_by(Question.order).all()
    
    # Generate DOCX
    docx_buffer = generate_docx(project, questions)
    
    filename = f'{project.name.replace(" ", "_")}_Response.docx'
    
    return send_file(
        docx_buffer,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        as_attachment=True,
        download_name=filename
    )


@bp.route('/xlsx', methods=['POST'])
@jwt_required()
def export_xlsx():
    """Export project as XLSX."""
    from ..services.export_service import generate_xlsx
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get questions
    questions = Question.query.filter_by(
        project_id=project_id
    ).order_by(Question.order).all()
    
    # Generate XLSX
    xlsx_buffer = generate_xlsx(project, questions)
    
    filename = f'{project.name.replace(" ", "_")}_Response.xlsx'
    
    return send_file(
        xlsx_buffer,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )


@bp.route('/complete', methods=['POST'])
@jwt_required()
def complete_project():
    """Mark project as complete."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    project.status = 'completed'
    project.completion_percent = 100
    db.session.commit()
    
    # ========================================
    # AUTO-TRIGGER APPROVAL WORKFLOW (Phase 3)
    # ========================================
    # If organization has a default approval workflow, automatically submit for approval
    approval_request = None
    try:
        from ..models import ApprovalWorkflow, ApprovalRequest, ApprovalStage
        
        # Find default workflow for this organization
        default_workflow = ApprovalWorkflow.query.filter_by(
            organization_id=user.organization_id,
            is_default=True,
            is_active=True
        ).first()
        
        if default_workflow:
            # Get first stage of workflow
            first_stage = default_workflow.stages.order_by(ApprovalStage.order).first()
            
            # Create approval request
            approval_request = ApprovalRequest(
                organization_id=user.organization_id,
                workflow_id=default_workflow.id,
                project_id=project.id,
                title=f"Approval Request: {project.name}",
                notes=f"Auto-submitted for approval upon project completion.",
                status='pending',
                current_stage_id=first_stage.id if first_stage else None,
                submitted_by=user_id,
                request_metadata={
                    'client_name': project.client_name,
                    'industry': project.industry,
                    'auto_triggered': True
                }
            )
            db.session.add(approval_request)
            db.session.commit()
            
            print(f"[WORKFLOW] Auto-submitted approval request {approval_request.id} for project {project.id}")
            
            # TODO: Send notification to first stage approvers
            # This would trigger email notifications in a full implementation
            
    except Exception as e:
        import logging
        logging.warning(f"Failed to auto-trigger approval workflow: {e}")
        # Don't fail the completion - workflow is optional
    
    return jsonify({
        'message': 'Project marked as complete',
        'project': project.to_dict(),
        'approval_request': approval_request.to_dict() if approval_request else None,
        'workflow_triggered': approval_request is not None
    }), 200


@bp.route('/pdf', methods=['POST'])
@jwt_required()
def export_pdf():
    """Export project as PDF."""
    from ..services.pdf_service import get_pdf_service
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get questions
    questions = Question.query.filter_by(
        project_id=project_id
    ).order_by(Question.order).all()
    
    # Convert to dict format for PDF service
    project_dict = {
        'name': project.name,
        'description': project.description or '',
        'status': project.status,
        'due_date': str(project.due_date) if project.due_date else None
    }
    
    questions_list = []
    for q in questions:
        answer = q.current_answer
        questions_list.append({
            'text': q.text,
            'section': q.section or 'General',
            'status': q.status,
            'answer': {
                'content': answer.content if answer else None,
                'confidence_score': answer.confidence_score if answer else None,
                'sources': []  # Could add sources if available
            } if answer else None
        })
    
    # Generate PDF
    pdf_service = get_pdf_service()
    pdf_bytes = pdf_service.generate_project_export(
        project_dict,
        questions_list,
        include_unanswered=data.get('include_unanswered', False),
        include_sources=data.get('include_sources', True),
        include_confidence=data.get('include_confidence', True)
    )
    
    filename = f'{project.name.replace(" ", "_")}_Response.pdf'
    
    return send_file(
        BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=filename
    )
