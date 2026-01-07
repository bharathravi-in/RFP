"""
Revenue Tracking Routes for proposal financial management.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy import func

from ..extensions import db
from ..models import User, Project, ProposalRevenue, RevenueReport

bp = Blueprint('revenue', __name__)


# =============================================================================
# PROPOSAL REVENUE
# =============================================================================

@bp.route('/projects/<int:project_id>/revenue', methods=['GET'])
@jwt_required()
def get_project_revenue(project_id):
    """Get revenue data for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    revenue = ProposalRevenue.query.filter_by(project_id=project_id).first()
    
    if not revenue:
        return jsonify({'revenue': None}), 200
    
    return jsonify({'revenue': revenue.to_dict()}), 200


@bp.route('/projects/<int:project_id>/revenue', methods=['POST', 'PUT'])
@jwt_required()
def update_project_revenue(project_id):
    """Create or update revenue data for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.get_json()
    
    revenue = ProposalRevenue.query.filter_by(project_id=project_id).first()
    
    if not revenue:
        revenue = ProposalRevenue(
            organization_id=user.organization_id,
            project_id=project_id
        )
        db.session.add(revenue)
    
    # Update fields
    fields = [
        'proposed_value', 'final_value', 'currency', 'contract_type',
        'contract_duration_months', 'recurring_revenue', 'recurring_period',
        'outcome', 'outcome_reason', 'competitor_won',
        'primary_owner_id', 'team_members', 'pipeline_stage',
        'probability_percent', 'estimated_cost', 'actual_cost'
    ]
    
    for field in fields:
        if field in data:
            value = data[field]
            # Handle decimal fields
            if field in ['proposed_value', 'final_value', 'recurring_revenue', 
                        'estimated_cost', 'actual_cost'] and value is not None:
                value = Decimal(str(value))
            setattr(revenue, field, value)
    
    # Handle date fields
    if 'outcome_date' in data and data['outcome_date']:
        revenue.outcome_date = datetime.strptime(data['outcome_date'], '%Y-%m-%d').date()
    if 'expected_close_date' in data and data['expected_close_date']:
        revenue.expected_close_date = datetime.strptime(data['expected_close_date'], '%Y-%m-%d').date()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Revenue updated',
        'revenue': revenue.to_dict()
    }), 200


@bp.route('/projects/<int:project_id>/outcome', methods=['POST'])
@jwt_required()
def record_outcome(project_id):
    """Record win/loss outcome for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.get_json()
    outcome = data.get('outcome')  # won, lost, no_decision, cancelled
    
    if outcome not in ['won', 'lost', 'no_decision', 'cancelled']:
        return jsonify({'error': 'Invalid outcome'}), 400
    
    revenue = ProposalRevenue.query.filter_by(project_id=project_id).first()
    if not revenue:
        revenue = ProposalRevenue(
            organization_id=user.organization_id,
            project_id=project_id
        )
        db.session.add(revenue)
    
    revenue.outcome = outcome
    revenue.outcome_date = date.today()
    revenue.outcome_reason = data.get('reason')
    revenue.competitor_won = data.get('competitor_won')
    
    if outcome == 'won':
        revenue.pipeline_stage = 'closed'
        revenue.probability_percent = 100
        if data.get('final_value'):
            revenue.final_value = Decimal(str(data['final_value']))
    elif outcome == 'lost':
        revenue.pipeline_stage = 'closed'
        revenue.probability_percent = 0
    
    db.session.commit()
    
    return jsonify({
        'message': f'Outcome recorded as {outcome}',
        'revenue': revenue.to_dict()
    }), 200


# =============================================================================
# PIPELINE & ANALYTICS
# =============================================================================

@bp.route('/pipeline', methods=['GET'])
@jwt_required()
def get_pipeline():
    """Get revenue pipeline overview."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Get all active proposals (not closed)
    revenues = ProposalRevenue.query.filter(
        ProposalRevenue.organization_id == user.organization_id,
        ProposalRevenue.outcome.is_(None)  # Open opportunities
    ).all()
    
    # Group by stage
    stages = {}
    total_pipeline = Decimal('0')
    weighted_pipeline = Decimal('0')
    
    for rev in revenues:
        stage = rev.pipeline_stage or 'qualification'
        if stage not in stages:
            stages[stage] = {
                'count': 0,
                'total_value': Decimal('0'),
                'weighted_value': Decimal('0')
            }
        
        stages[stage]['count'] += 1
        if rev.proposed_value:
            stages[stage]['total_value'] += rev.proposed_value
            total_pipeline += rev.proposed_value
            
            prob = Decimal(str(rev.probability_percent or 50)) / 100
            weighted = rev.proposed_value * prob
            stages[stage]['weighted_value'] += weighted
            weighted_pipeline += weighted
    
    # Convert Decimals for JSON
    for stage in stages:
        stages[stage]['total_value'] = float(stages[stage]['total_value'])
        stages[stage]['weighted_value'] = float(stages[stage]['weighted_value'])
    
    return jsonify({
        'pipeline': {
            'total_value': float(total_pipeline),
            'weighted_value': float(weighted_pipeline),
            'total_opportunities': len(revenues),
            'by_stage': stages
        }
    }), 200


@bp.route('/dashboard', methods=['GET'])
@jwt_required()
def revenue_dashboard():
    """Get revenue dashboard metrics."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Time period filter
    period = request.args.get('period', 'quarter')  # month, quarter, year, all
    
    # Calculate date range
    today = date.today()
    if period == 'month':
        start_date = today.replace(day=1)
    elif period == 'quarter':
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start_date = today.replace(month=quarter_month, day=1)
    elif period == 'year':
        start_date = today.replace(month=1, day=1)
    else:
        start_date = None
    
    # Base query
    query = ProposalRevenue.query.filter_by(organization_id=user.organization_id)
    
    if start_date:
        query = query.filter(ProposalRevenue.created_at >= start_date)
    
    all_revenues = query.all()
    
    # Calculate metrics
    won = [r for r in all_revenues if r.outcome == 'won']
    lost = [r for r in all_revenues if r.outcome == 'lost']
    open_opps = [r for r in all_revenues if r.outcome is None]
    
    total_won = sum(float(r.final_value or r.proposed_value or 0) for r in won)
    total_lost = sum(float(r.proposed_value or 0) for r in lost)
    total_pipeline = sum(float(r.proposed_value or 0) for r in open_opps)
    weighted_pipeline = sum(float(r.weighted_value or 0) for r in open_opps)
    
    # Win rate
    decided = len(won) + len(lost)
    win_rate = (len(won) / decided * 100) if decided > 0 else 0
    
    # Average deal size
    avg_deal_size = total_won / len(won) if won else 0
    
    # By contract type
    by_contract_type = {}
    for r in won:
        ct = r.contract_type or 'unknown'
        if ct not in by_contract_type:
            by_contract_type[ct] = {'count': 0, 'value': 0}
        by_contract_type[ct]['count'] += 1
        by_contract_type[ct]['value'] += float(r.final_value or r.proposed_value or 0)
    
    return jsonify({
        'dashboard': {
            'period': period,
            'start_date': str(start_date) if start_date else None,
            'total_won_value': total_won,
            'total_lost_value': total_lost,
            'total_pipeline_value': total_pipeline,
            'weighted_pipeline_value': weighted_pipeline,
            'proposals_won': len(won),
            'proposals_lost': len(lost),
            'proposals_open': len(open_opps),
            'win_rate_percent': round(win_rate, 1),
            'avg_deal_size': round(avg_deal_size, 2),
            'by_contract_type': by_contract_type
        }
    }), 200


@bp.route('/trends', methods=['GET'])
@jwt_required()
def revenue_trends():
    """Get revenue trends over time."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Last 12 months
    months = []
    today = date.today()
    
    for i in range(11, -1, -1):
        # Calculate month start/end
        month_date = today.replace(day=1) - timedelta(days=i*30)
        month_start = month_date.replace(day=1)
        if month_date.month == 12:
            month_end = month_date.replace(year=month_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = month_date.replace(month=month_date.month + 1, day=1) - timedelta(days=1)
        
        # Get revenue for this month
        won = ProposalRevenue.query.filter(
            ProposalRevenue.organization_id == user.organization_id,
            ProposalRevenue.outcome == 'won',
            ProposalRevenue.outcome_date >= month_start,
            ProposalRevenue.outcome_date <= month_end
        ).all()
        
        lost = ProposalRevenue.query.filter(
            ProposalRevenue.organization_id == user.organization_id,
            ProposalRevenue.outcome == 'lost',
            ProposalRevenue.outcome_date >= month_start,
            ProposalRevenue.outcome_date <= month_end
        ).all()
        
        months.append({
            'month': month_start.strftime('%Y-%m'),
            'month_name': month_start.strftime('%b %Y'),
            'won_value': sum(float(r.final_value or r.proposed_value or 0) for r in won),
            'won_count': len(won),
            'lost_value': sum(float(r.proposed_value or 0) for r in lost),
            'lost_count': len(lost),
            'win_rate': round(len(won) / (len(won) + len(lost)) * 100, 1) if (len(won) + len(lost)) > 0 else 0
        })
    
    return jsonify({
        'trends': months
    }), 200


@bp.route('/leaderboard', methods=['GET'])
@jwt_required()
def revenue_leaderboard():
    """Get team leaderboard by revenue."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    period = request.args.get('period', 'quarter')
    
    # Calculate date range
    today = date.today()
    if period == 'month':
        start_date = today.replace(day=1)
    elif period == 'quarter':
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start_date = today.replace(month=quarter_month, day=1)
    else:
        start_date = today.replace(month=1, day=1)
    
    # Get won deals
    won = ProposalRevenue.query.filter(
        ProposalRevenue.organization_id == user.organization_id,
        ProposalRevenue.outcome == 'won',
        ProposalRevenue.outcome_date >= start_date
    ).all()
    
    # Group by owner
    by_owner = {}
    for r in won:
        owner_id = r.primary_owner_id
        if owner_id:
            if owner_id not in by_owner:
                owner = User.query.get(owner_id)
                by_owner[owner_id] = {
                    'user_id': owner_id,
                    'name': owner.name if owner else 'Unknown',
                    'won_value': 0,
                    'won_count': 0
                }
            by_owner[owner_id]['won_value'] += float(r.final_value or r.proposed_value or 0)
            by_owner[owner_id]['won_count'] += 1
    
    # Sort by value
    leaderboard = sorted(by_owner.values(), key=lambda x: x['won_value'], reverse=True)
    
    return jsonify({
        'period': period,
        'leaderboard': leaderboard
    }), 200
