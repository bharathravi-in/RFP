"""
Analytics and Statistics API routes.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta
from ..extensions import db
from ..models import User, Project, Question, Answer, Document, KnowledgeItem, RFPSection, Organization
from ..models.feedback import AgentPerformance

bp = Blueprint('analytics', __name__)


@bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage_stats():
    """
    Get organization usage statistics with plan limits.
    
    Returns current consumption vs. plan limits for:
    - Users
    - Projects
    - Documents
    - Knowledge items
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.organization_id:
        return jsonify({'error': 'No organization found'}), 404
    
    org = Organization.query.get(user.organization_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    
    # Get current usage counts
    user_count = User.query.filter_by(organization_id=org.id).count()
    project_count = Project.query.filter_by(organization_id=org.id).count()
    document_count = db.session.query(Document).join(Project).filter(
        Project.organization_id == org.id
    ).count()
    knowledge_count = KnowledgeItem.query.filter_by(
        organization_id=org.id,
        is_active=True
    ).count()
    
    # Calculate usage percentages (-1 means unlimited)
    def calc_percentage(current, max_val):
        if max_val == -1:
            return 0  # Unlimited
        return round(current / max(max_val, 1) * 100, 1)
    
    # Get additional stats
    total_questions = db.session.query(Question).join(Project).filter(
        Project.organization_id == org.id
    ).count()
    
    answered_questions = db.session.query(Question).join(Project).filter(
        Project.organization_id == org.id,
        Question.status.in_(['answered', 'approved'])
    ).count()
    
    approved_answers = db.session.query(Answer).join(Question).join(Project).filter(
        Project.organization_id == org.id,
        Answer.status == 'approved'
    ).count()
    
    # AI generations this month
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    ai_generations = db.session.query(Answer).join(Question).join(Project).filter(
        Project.organization_id == org.id,
        Answer.is_ai_generated == True,
        Answer.created_at >= month_start
    ).count()
    
    return jsonify({
        'organization': {
            'id': org.id,
            'name': org.name,
            'subscription_plan': org.subscription_plan,
            'subscription_status': org.subscription_status,
            'is_trial_active': org.is_trial_active,
            'trial_days_remaining': org.trial_days_remaining if org.is_trial_active else None,
            'trial_ends_at': org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        },
        'usage': {
            'users': {
                'current': user_count,
                'limit': org.max_users,
                'percentage': calc_percentage(user_count, org.max_users),
                'unlimited': org.max_users == -1
            },
            'projects': {
                'current': project_count,
                'limit': org.max_projects,
                'percentage': calc_percentage(project_count, org.max_projects),
                'unlimited': org.max_projects == -1
            },
            'documents': {
                'current': document_count,
                'limit': org.max_documents,
                'percentage': calc_percentage(document_count, org.max_documents),
                'unlimited': org.max_documents == -1
            },
            'knowledge_items': {
                'current': knowledge_count,
                'limit': -1,  # No limit on knowledge items
                'percentage': 0,
                'unlimited': True
            }
        },
        'activity': {
            'total_questions': total_questions,
            'answered_questions': answered_questions,
            'approved_answers': approved_answers,
            'answer_rate': round(answered_questions / max(total_questions, 1) * 100, 1),
            'approval_rate': round(approved_answers / max(answered_questions, 1) * 100, 1),
            'ai_generations_this_month': ai_generations
        }
    }), 200


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


@bp.route('/project-health/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project_health(project_id):
    """
    Get detailed health metrics for a specific project.
    
    Returns:
    - Completion %
    - Owners breakdown
    - SME bottlenecks
    - Verification score average
    - Due date status
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
        
    # Check if user belongs to the same org
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Unauthorized'}), 403

    questions = Question.query.filter_by(project_id=project_id).all()
    total_questions = len(questions)
    
    # Also get sections for proposal-based completion
    sections = RFPSection.query.filter_by(project_id=project_id).all()
    total_sections = len(sections)
    approved_sections = sum(1 for s in sections if s.status == 'approved')
    
    # Use sections if no questions, otherwise use questions
    if total_sections > 0 and total_questions == 0:
        # Proposal-based workflow
        completion_percentage = (approved_sections / total_sections) * 100
        answered_count = approved_sections
        total_items = total_sections
        item_type = 'sections'
    elif total_questions > 0:
        # Q&A-based workflow
        answered_count = sum(1 for q in questions if q.status in ['answered', 'approved'])
        completion_percentage = (answered_count / total_questions) * 100
        total_items = total_questions
        item_type = 'questions'
    else:
        return jsonify({
            'completion_percentage': 0,
            'owners_breakdown': [],
            'bottlenecks': [],
            'verification_health': 0,
            'project_name': project.name,
            'status': project.status,
            'due_date': project.due_date.isoformat() if project.due_date else None
        }), 200

    # Owners breakdown
    owners_stats = {}
    for q in questions:
        owner_name = q.assignee.name if q.assignee else 'Unassigned'
        owner_id = q.assigned_to or 0
        
        if owner_id not in owners_stats:
            owners_stats[owner_id] = {
                'name': owner_name,
                'total': 0,
                'answered': 0,
                'pending': 0
            }
        
        owners_stats[owner_id]['total'] += 1
        if q.status in ['answered', 'approved']:
            owners_stats[owner_id]['answered'] += 1
        else:
            owners_stats[owner_id]['pending'] += 1

    owners_list = list(owners_stats.values())
    
    # Bottlenecks (more than 5 pending questions or 50% of project pending)
    bottlenecks = [o for o in owners_list if o['pending'] > 5 and o['name'] != 'Unassigned']

    # Verification Health
    answers = db.session.query(Answer).join(Question).filter(Question.project_id == project_id).all()
    verification_scores = [a.verification_score for a in answers if a.verification_score is not None]
    avg_verification = sum(verification_scores) / len(verification_scores) if verification_scores else 0

    return jsonify({
        'project_id': project_id,
        'project_name': project.name,
        'completion_percentage': round(completion_percentage, 2),
        'total_questions': total_items,
        'answered_count': answered_count,
        'item_type': item_type if 'item_type' in dir() else 'questions',
        'owners_breakdown': owners_list,
        'bottlenecks': bottlenecks,
        'verification_health': round(avg_verification, 4),
        'status': project.status,
        'due_date': project.due_date.isoformat() if project.due_date else None
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


@bp.route('/overview', methods=['GET'])
@jwt_required()
def get_analytics_overview():
    """Get high-level analytics overview including win/loss stats."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    org_id = user.organization_id
    
    # Project outcome counts
    outcome_counts = db.session.query(
        Project.outcome,
        func.count(Project.id)
    ).filter(
        Project.organization_id == org_id
    ).group_by(Project.outcome).all()
    
    outcomes = {outcome or 'pending': count for outcome, count in outcome_counts}
    total = sum(outcomes.values())
    won = outcomes.get('won', 0)
    lost = outcomes.get('lost', 0)
    pending = outcomes.get('pending', 0)
    abandoned = outcomes.get('abandoned', 0)
    
    # Calculate win rate (won / (won + lost))
    decided = won + lost
    win_rate = round(won / max(decided, 1) * 100, 1)
    
    # Total contract value from won projects
    total_won_value = db.session.query(
        func.sum(Project.contract_value)
    ).filter(
        Project.organization_id == org_id,
        Project.outcome == 'won'
    ).scalar() or 0
    
    # Average project value
    avg_project_value = db.session.query(
        func.avg(Project.project_value)
    ).filter(
        Project.organization_id == org_id,
        Project.project_value.isnot(None)
    ).scalar() or 0
    
    return jsonify({
        'overview': {
            'total_projects': total,
            'won': won,
            'lost': lost,
            'pending': pending,
            'abandoned': abandoned,
            'win_rate': win_rate,
            'total_won_value': round(total_won_value, 2),
            'avg_project_value': round(avg_project_value, 2),
        }
    }), 200


@bp.route('/win-rate-trend', methods=['GET'])
@jwt_required()
def get_win_rate_trend():
    """Get win rate trend over time (monthly for last 12 months)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    org_id = user.organization_id
    
    # Get monthly win/loss counts for last 12 months
    months = []
    for i in range(11, -1, -1):
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0) - timedelta(days=i*30)
        month_end = month_start + timedelta(days=30)
        
        won = Project.query.filter(
            Project.organization_id == org_id,
            Project.outcome == 'won',
            Project.outcome_date.between(month_start, month_end)
        ).count()
        
        lost = Project.query.filter(
            Project.organization_id == org_id,
            Project.outcome == 'lost',
            Project.outcome_date.between(month_start, month_end)
        ).count()
        
        decided = won + lost
        win_rate = round(won / max(decided, 1) * 100, 1) if decided > 0 else None
        
        months.append({
            'month': month_start.strftime('%b %Y'),
            'won': won,
            'lost': lost,
            'win_rate': win_rate
        })
    
    return jsonify({'trend': months}), 200


@bp.route('/response-times', methods=['GET'])
@jwt_required()
def get_response_times():
    """Get average response times by project status."""
    from ..models import RFPSection
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    org_id = user.organization_id
    
    # Average days from creation to completion
    completed_projects = Project.query.filter(
        Project.organization_id == org_id,
        Project.status == 'completed'
    ).all()
    
    if completed_projects:
        total_days = sum(
            (p.updated_at - p.created_at).days 
            for p in completed_projects 
            if p.updated_at and p.created_at
        )
        avg_completion_days = round(total_days / len(completed_projects), 1)
    else:
        avg_completion_days = 0
    
    # Average sections per project
    avg_sections = db.session.query(
        func.avg(
            db.session.query(func.count(RFPSection.id))
            .filter(RFPSection.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )
    ).filter(
        Project.organization_id == org_id
    ).scalar() or 0
    
    # Projects by status
    status_breakdown = db.session.query(
        Project.status,
        func.count(Project.id)
    ).filter(
        Project.organization_id == org_id
    ).group_by(Project.status).all()
    
    return jsonify({
        'response_times': {
            'avg_completion_days': avg_completion_days,
            'avg_sections_per_project': round(float(avg_sections), 1),
            'projects_by_status': {status: count for status, count in status_breakdown}
        }
    }), 200


@bp.route('/team-metrics', methods=['GET'])
@jwt_required()
def get_team_metrics():
    """Get team member contribution metrics."""
    from ..models import RFPSection
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    org_id = user.organization_id
    
    # Get all users in organization
    team_members = User.query.filter_by(organization_id=org_id).all()
    
    metrics = []
    for member in team_members:
        # Projects created
        projects_created = Project.query.filter_by(
            created_by=member.id,
            organization_id=org_id
        ).count()
        
        # Sections assigned and completed
        sections_assigned = RFPSection.query.join(Project).filter(
            Project.organization_id == org_id,
            RFPSection.assigned_to == member.id
        ).count()
        
        sections_completed = RFPSection.query.join(Project).filter(
            Project.organization_id == org_id,
            RFPSection.assigned_to == member.id,
            RFPSection.status == 'approved'
        ).count()
        
        # Answers reviewed (Answer model has reviewed_by, not created_by)
        answers_reviewed = db.session.query(Answer).filter(
            Answer.reviewed_by == member.id
        ).count()
        
        metrics.append({
            'user_id': member.id,
            'name': member.name,
            'email': member.email,
            'role': member.role,
            'projects_created': projects_created,
            'sections_assigned': sections_assigned,
            'sections_completed': sections_completed,
            'answers_reviewed': answers_reviewed,
            'completion_rate': round(sections_completed / max(sections_assigned, 1) * 100, 1)
        })
    
    # Sort by sections completed
    metrics.sort(key=lambda x: x['sections_completed'], reverse=True)
    
    return jsonify({'team_metrics': metrics}), 200


@bp.route('/loss-reasons', methods=['GET'])
@jwt_required()
def get_loss_reasons():
    """Get breakdown of loss reasons."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
    
    org_id = user.organization_id
    
    # Get loss reason counts
    loss_reasons = db.session.query(
        Project.loss_reason,
        func.count(Project.id)
    ).filter(
        Project.organization_id == org_id,
        Project.outcome == 'lost',
        Project.loss_reason.isnot(None)
    ).group_by(Project.loss_reason).all()
    
    reasons = [
        {'reason': reason or 'Unknown', 'count': count}
        for reason, count in loss_reasons
    ]
    
    return jsonify({'loss_reasons': reasons}), 200


@bp.route('/content-performance', methods=['GET'])
@jwt_required()
def get_content_performance():
    """Get performance metrics for library content."""
    from ..models import AnswerLibraryItem
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
        
    org_id = user.organization_id
    
    # Top used items
    top_used = AnswerLibraryItem.query.filter_by(
        organization_id=org_id,
        is_active=True
    ).order_by(AnswerLibraryItem.times_used.desc()).limit(10).all()
    
    # Highest helpfulness items
    best_rated = AnswerLibraryItem.query.filter(
        AnswerLibraryItem.organization_id == org_id,
        AnswerLibraryItem.is_active == True,
        AnswerLibraryItem.times_used > 0
    ).order_by(
        (AnswerLibraryItem.times_helpful / AnswerLibraryItem.times_used).desc()
    ).limit(10).all()
    
    # Category performance
    category_stats = db.session.query(
        AnswerLibraryItem.category,
        func.count(AnswerLibraryItem.id),
        func.sum(AnswerLibraryItem.times_used),
        func.sum(AnswerLibraryItem.times_helpful)
    ).filter(
        AnswerLibraryItem.organization_id == org_id,
        AnswerLibraryItem.is_active == True
    ).group_by(AnswerLibraryItem.category).all()
    
    categories = []
    for cat, count, used, helpful in category_stats:
        if cat:
            categories.append({
                'category': cat,
                'count': count,
                'total_usage': used or 0,
                'total_helpful': helpful or 0,
                'helpfulness_rate': round((helpful or 0) / max(used or 1, 1) * 100, 1)
            })
    
    return jsonify({
        'top_used': [item.to_dict() for item in top_used],
        'best_rated': [item.to_dict() for item in best_rated],
        'category_performance': categories
    }), 200


@bp.route('/win-loss-deep-dive', methods=['GET'])
@jwt_required()
def win_loss_deep_dive():
    """Deep dive into win/loss factors."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'error': 'Organization not found'}), 404
        
    org_id = user.organization_id
    
    def get_dimension_stats(column):
        results = db.session.query(
            column,
            func.count(Project.id).label('total'),
            func.sum(db.case((Project.outcome == 'won', 1), else_=0)).label('won'),
            func.sum(db.case((Project.outcome == 'lost', 1), else_=0)).label('lost')
        ).filter(
            Project.organization_id == org_id,
            column.isnot(None)
        ).group_by(column).all()
        
        return [
            {
                'name': name,
                'total': total,
                'won': won,
                'lost': lost,
                'win_rate': round(won / max(won + lost, 1) * 100, 1) if (won + lost) > 0 else None
            }
            for name, total, won, lost in results
        ]

    return jsonify({
        'by_client_type': get_dimension_stats(Project.client_type),
        'by_industry': get_dimension_stats(Project.industry),
        'by_geography': get_dimension_stats(Project.geography)
    }), 200


@bp.route('/agent-performance', methods=['GET'])
@jwt_required()
def get_agent_performance():
    """
    Get agent performance metrics for the organization.
    
    Query params:
        days: Number of days to look back (default 30)
        agent: Filter by agent name
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check for super admin or org access
    org_id = user.organization_id
    is_super_admin = getattr(user, 'is_super_admin', False)
    
    # Parse query params
    days = request.args.get('days', 30, type=int)
    agent_filter = request.args.get('agent')
    
    # Date range
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Base query
    query = AgentPerformance.query.filter(
        AgentPerformance.created_at >= start_date
    )
    
    # Filter by organization (via project) unless super admin
    if not is_super_admin and org_id:
        query = query.join(Project).filter(Project.organization_id == org_id)
    
    # Filter by agent name if specified
    if agent_filter:
        query = query.filter(AgentPerformance.agent_name == agent_filter)
    
    # Get metrics
    metrics = query.order_by(AgentPerformance.created_at.desc()).limit(500).all()
    
    # Calculate aggregates by agent
    agent_stats = {}
    for m in metrics:
        name = m.agent_name
        if name not in agent_stats:
            agent_stats[name] = {
                'agent_name': name,
                'total_executions': 0,
                'successful': 0,
                'failed': 0,
                'total_time_ms': 0,
                'errors': []
            }
        
        agent_stats[name]['total_executions'] += 1
        if m.success:
            agent_stats[name]['successful'] += 1
        else:
            agent_stats[name]['failed'] += 1
            if m.error_message:
                agent_stats[name]['errors'].append({
                    'time': m.created_at.isoformat() if m.created_at else None,
                    'message': m.error_message[:200]  # Truncate
                })
        
        if m.execution_time_ms:
            agent_stats[name]['total_time_ms'] += m.execution_time_ms
    
    # Calculate averages and success rates
    for name, stats in agent_stats.items():
        total = stats['total_executions']
        stats['success_rate'] = round(stats['successful'] / max(total, 1) * 100, 1)
        stats['avg_execution_time_ms'] = round(stats['total_time_ms'] / max(total, 1), 0)
        stats['errors'] = stats['errors'][:5]  # Keep only last 5 errors
    
    # Overall stats
    total_executions = sum(s['total_executions'] for s in agent_stats.values())
    total_successful = sum(s['successful'] for s in agent_stats.values())
    total_time = sum(s['total_time_ms'] for s in agent_stats.values())
    
    # Recent executions for table
    recent = [{
        'id': m.id,
        'agent_name': m.agent_name,
        'step_name': m.step_name,
        'execution_time_ms': m.execution_time_ms,
        'success': m.success,
        'error_message': m.error_message[:100] if m.error_message else None,
        'context': m.context_data,
        'created_at': m.created_at.isoformat() if m.created_at else None
    } for m in metrics[:50]]
    
    return jsonify({
        'summary': {
            'total_executions': total_executions,
            'successful': total_successful,
            'failed': total_executions - total_successful,
            'overall_success_rate': round(total_successful / max(total_executions, 1) * 100, 1),
            'avg_execution_time_ms': round(total_time / max(total_executions, 1), 0),
            'period_days': days
        },
        'by_agent': list(agent_stats.values()),
        'recent_executions': recent
    }), 200
