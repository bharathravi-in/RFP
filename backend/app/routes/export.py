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
    user_id = get_jwt_identity()
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
            'status': answer.status if answer else 'unanswered',
            'confidence': answer.confidence_score if answer else 0
        })
    
    return jsonify({
        'project_name': project.name,
        'total_questions': len(questions),
        'answered': sum(1 for q in questions if q.current_answer),
        'approved': sum(1 for q in questions if q.status == 'approved'),
        'content': preview_data
    }), 200


@bp.route('/pdf', methods=['POST'])
@jwt_required()
def export_pdf():
    """Export project as PDF."""
    user_id = get_jwt_identity()
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
    
    # TODO: Generate PDF using reportlab or weasyprint
    # from ..services.export_service import generate_pdf
    # pdf_buffer = generate_pdf(project)
    
    # Placeholder
    return jsonify({
        'message': 'PDF export not yet implemented',
        'status': 'pending'
    }), 501


@bp.route('/docx', methods=['POST'])
@jwt_required()
def export_docx():
    """Export project as DOCX."""
    user_id = get_jwt_identity()
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
    
    # TODO: Generate DOCX using python-docx
    # from ..services.export_service import generate_docx
    # docx_buffer = generate_docx(project)
    
    # Placeholder
    return jsonify({
        'message': 'DOCX export not yet implemented',
        'status': 'pending'
    }), 501


@bp.route('/xlsx', methods=['POST'])
@jwt_required()
def export_xlsx():
    """Export project as XLSX."""
    user_id = get_jwt_identity()
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
    
    # TODO: Generate XLSX using openpyxl
    # from ..services.export_service import generate_xlsx
    # xlsx_buffer = generate_xlsx(project)
    
    # Placeholder
    return jsonify({
        'message': 'XLSX export not yet implemented',
        'status': 'pending'
    }), 501
