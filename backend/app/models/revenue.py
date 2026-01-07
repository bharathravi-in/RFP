"""
Revenue Tracking Models for RFP/proposal financial management.

Tracks proposal values, win/loss outcomes, and revenue attribution.
"""
from datetime import datetime
from ..extensions import db


class ProposalRevenue(db.Model):
    """Revenue tracking for proposals/projects."""
    
    __tablename__ = 'proposal_revenues'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    
    # Proposal value
    proposed_value = db.Column(db.Numeric(15, 2))  # Initial proposed value
    final_value = db.Column(db.Numeric(15, 2))  # Final contracted value
    currency = db.Column(db.String(3), default='USD')
    
    # Contract details
    contract_type = db.Column(db.String(50))  # fixed_price, time_materials, retainer, subscription
    contract_duration_months = db.Column(db.Integer)
    recurring_revenue = db.Column(db.Numeric(15, 2))  # Monthly/Annual recurring
    recurring_period = db.Column(db.String(20))  # monthly, quarterly, annually
    
    # Outcome tracking
    outcome = db.Column(db.String(50))  # won, lost, pending, no_decision, cancelled
    outcome_date = db.Column(db.Date)
    outcome_reason = db.Column(db.Text)
    competitor_won = db.Column(db.String(200))  # If lost, who won
    
    # Attribution
    primary_owner_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    team_members = db.Column(db.JSON, default=list)  # [{"user_id": 1, "contribution_percent": 50}]
    
    # Pipeline stage
    pipeline_stage = db.Column(db.String(50), default='qualification')  # qualification, proposal, negotiation, closed
    probability_percent = db.Column(db.Integer, default=50)  # Win probability
    expected_close_date = db.Column(db.Date)
    
    # Costs
    estimated_cost = db.Column(db.Numeric(15, 2))
    actual_cost = db.Column(db.Numeric(15, 2))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization')
    project = db.relationship('Project', backref=db.backref('revenue', uselist=False))
    primary_owner = db.relationship('User', foreign_keys=[primary_owner_id])
    
    @property
    def gross_margin(self):
        """Calculate gross margin percentage."""
        if self.final_value and self.actual_cost and self.final_value > 0:
            return float((self.final_value - self.actual_cost) / self.final_value * 100)
        return None
    
    @property
    def weighted_value(self):
        """Calculate probability-weighted value."""
        if self.proposed_value and self.probability_percent:
            return float(self.proposed_value * self.probability_percent / 100)
        return 0
    
    def to_dict(self):
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'project_id': self.project_id,
            'proposed_value': float(self.proposed_value) if self.proposed_value else None,
            'final_value': float(self.final_value) if self.final_value else None,
            'currency': self.currency,
            'contract_type': self.contract_type,
            'contract_duration_months': self.contract_duration_months,
            'recurring_revenue': float(self.recurring_revenue) if self.recurring_revenue else None,
            'recurring_period': self.recurring_period,
            'outcome': self.outcome,
            'outcome_date': str(self.outcome_date) if self.outcome_date else None,
            'outcome_reason': self.outcome_reason,
            'competitor_won': self.competitor_won,
            'primary_owner_id': self.primary_owner_id,
            'primary_owner_name': self.primary_owner.name if self.primary_owner else None,
            'team_members': self.team_members or [],
            'pipeline_stage': self.pipeline_stage,
            'probability_percent': self.probability_percent,
            'expected_close_date': str(self.expected_close_date) if self.expected_close_date else None,
            'estimated_cost': float(self.estimated_cost) if self.estimated_cost else None,
            'actual_cost': float(self.actual_cost) if self.actual_cost else None,
            'gross_margin': self.gross_margin,
            'weighted_value': self.weighted_value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class RevenueReport(db.Model):
    """Aggregated revenue reports for analytics."""
    
    __tablename__ = 'revenue_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    # Report period
    period_type = db.Column(db.String(20), nullable=False)  # daily, weekly, monthly, quarterly, yearly
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    
    # Pipeline metrics
    total_pipeline_value = db.Column(db.Numeric(15, 2), default=0)
    weighted_pipeline_value = db.Column(db.Numeric(15, 2), default=0)
    proposals_in_pipeline = db.Column(db.Integer, default=0)
    
    # Win metrics
    total_won_value = db.Column(db.Numeric(15, 2), default=0)
    proposals_won = db.Column(db.Integer, default=0)
    avg_deal_size = db.Column(db.Numeric(15, 2), default=0)
    
    # Loss metrics
    total_lost_value = db.Column(db.Numeric(15, 2), default=0)
    proposals_lost = db.Column(db.Integer, default=0)
    
    # Win rate
    win_rate_percent = db.Column(db.Numeric(5, 2), default=0)
    
    # Revenue metrics
    recurring_revenue_added = db.Column(db.Numeric(15, 2), default=0)
    one_time_revenue_added = db.Column(db.Numeric(15, 2), default=0)
    
    # By category breakdowns (JSON)
    by_contract_type = db.Column(db.JSON, default=dict)
    by_industry = db.Column(db.JSON, default=dict)
    by_owner = db.Column(db.JSON, default=dict)
    
    # Timestamps
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization')
    
    def to_dict(self):
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'period_type': self.period_type,
            'period_start': str(self.period_start) if self.period_start else None,
            'period_end': str(self.period_end) if self.period_end else None,
            'total_pipeline_value': float(self.total_pipeline_value) if self.total_pipeline_value else 0,
            'weighted_pipeline_value': float(self.weighted_pipeline_value) if self.weighted_pipeline_value else 0,
            'proposals_in_pipeline': self.proposals_in_pipeline,
            'total_won_value': float(self.total_won_value) if self.total_won_value else 0,
            'proposals_won': self.proposals_won,
            'avg_deal_size': float(self.avg_deal_size) if self.avg_deal_size else 0,
            'total_lost_value': float(self.total_lost_value) if self.total_lost_value else 0,
            'proposals_lost': self.proposals_lost,
            'win_rate_percent': float(self.win_rate_percent) if self.win_rate_percent else 0,
            'recurring_revenue_added': float(self.recurring_revenue_added) if self.recurring_revenue_added else 0,
            'one_time_revenue_added': float(self.one_time_revenue_added) if self.one_time_revenue_added else 0,
            'by_contract_type': self.by_contract_type or {},
            'by_industry': self.by_industry or {},
            'by_owner': self.by_owner or {},
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
        }
