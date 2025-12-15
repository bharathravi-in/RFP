"""
Analytics and Statistics API routes.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta
from ..extensions import db
from ..models import User, Project, Question, Answer, Document, KnowledgeItem

bp = Blueprint('analytics', __name__)


@bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """Get dashboard statistics for the user's organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.organization_id:
        return jsonify({
            'stats': {
                'total_projects': 0,
                'active_projects': 0,
                'total_questions': 0,
                'answered_questions': 0,
                'approved_answers': 0,
                'knowledge_items': 0,
            },
            'recent_projects': [],
            'activity': []
        }), 200
    
    org_id = user.organization_id
    
    # Project stats
    total_projects = Project.query.filter_by(organization_id=org_id).count()
    active_projects = Project.query.filter(
        Project.organization_id == org_id,
        Project.status.in_(['draft', 'in_progress'])
    ).count()
    
    # Question/Answer stats
    total_questions = db.session.query(Question).join(Project).filter(
        Project.organization_id == org_id
    ).count()
    
    answered_questions = db.session.query(Question).join(Project).filter(
        Project.organization_id == org_id,
        Question.status.in_(['answered', 'approved'])
    ).count()
    
    approved_answers = db.session.query(Answer).join(Question).join(Project).filter(
        Project.organization_id == org_id,
        Answer.status == 'approved'
    ).count()
    
    # Knowledge base stats
    knowledge_items = KnowledgeItem.query.filter_by(
        organization_id=org_id,
        is_active=True
    ).count()
    
    # Recent projects
    recent_projects = Project.query.filter_by(
        organization_id=org_id
    ).order_by(Project.updated_at.desc()).limit(5).all()
    
    # Weekly activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    activity = []
    
    for i in range(7):
        day = datetime.utcnow() - timedelta(days=6-i)
        day_start = day.replace(hour=0, minute=0, second=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        
        answers_count = db.session.query(Answer).join(Question).join(Project).filter(
            Project.organization_id == org_id,
            Answer.created_at.between(day_start, day_end)
        ).count()
        
        activity.append({
            'date': day_start.strftime('%Y-%m-%d'),
            'day': day_start.strftime('%a'),
            'answers': answers_count
        })
    
    return jsonify({
        'stats': {
            'total_projects': total_projects,
            'active_projects': active_projects,
            'total_questions': total_questions,
            'answered_questions': answered_questions,
            'approved_answers': approved_answers,
            'knowledge_items': knowledge_items,
            'answer_rate': round(answered_questions / max(total_questions, 1) * 100, 1),
            'approval_rate': round(approved_answers / max(answered_questions, 1) * 100, 1),
        },
        'recent_projects': [p.to_dict() for p in recent_projects],
        'activity': activity
    }), 200


@bp.route('/project/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project_stats(project_id):
    """Get detailed statistics for a specific project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Question breakdown by status
    status_counts = db.session.query(
        Question.status,
        func.count(Question.id)
    ).filter(
        Question.project_id == project_id
    ).group_by(Question.status).all()
    
    questions_by_status = {status: count for status, count in status_counts}
    
    # Section breakdown
    section_counts = db.session.query(
        Question.section,
        func.count(Question.id)
    ).filter(
        Question.project_id == project_id
    ).group_by(Question.section).all()
    
    sections = [
        {'name': section or 'General', 'count': count}
        for section, count in section_counts
    ]
    
    # Average confidence score
    avg_confidence = db.session.query(
        func.avg(Answer.confidence_score)
    ).join(Question).filter(
        Question.project_id == project_id
    ).scalar() or 0
    
    # Documents
    documents = Document.query.filter_by(project_id=project_id).all()
    
    return jsonify({
        'project': project.to_dict(),
        'stats': {
            'total_questions': sum(questions_by_status.values()),
            'questions_by_status': questions_by_status,
            'sections': sections,
            'avg_confidence': round(avg_confidence * 100, 1),
            'completion_percentage': project.calculate_completion(),
        },
        'documents': [d.to_dict() for d in documents]
    }), 200
