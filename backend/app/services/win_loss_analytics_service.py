"""
Win/Loss Analytics Service

Provides advanced analytics for proposal outcomes:
- Win rate by industry/client type/region
- Loss reason analysis
- Revenue attribution
- Trend analysis

Phase 4: Market Leader
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy import func, desc, case

from ..extensions import db
from ..models import Project, Organization

logger = logging.getLogger(__name__)


class WinLossAnalyticsService:
    """Service for advanced win/loss analytics."""
    
    def __init__(self, organization_id: int = None):
        self.organization_id = organization_id
    
    def get_win_rate_analysis(
        self,
        start_date: datetime = None,
        end_date: datetime = None,
        dimension: str = 'industry'  # industry, client_type, geography
    ) -> Dict[str, Any]:
        """
        Analyze win rates broken down by a specific dimension.
        
        Args:
            start_date: Start of analysis period
            end_date: End of analysis period
            dimension: Grouping dimension (industry, client_type, geography)
        
        Returns:
            Dict with overall stats and breakdown
        """
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=365)
        if not end_date:
            end_date = datetime.utcnow()
            
        # Base query for completed projects with outcomes
        base_query = db.session.query(
            getattr(Project, dimension).label('group_key'),
            func.count(Project.id).label('total_count'),
            func.sum(case((Project.outcome == 'won', 1), else_=0)).label('win_count'),
            func.sum(case((Project.outcome == 'lost', 1), else_=0)).label('loss_count'),
            func.sum(case((Project.contract_value != None, Project.contract_value), else_=0)).label('total_value'),
            func.sum(case((Project.outcome == 'won', Project.contract_value), else_=0)).label('won_value')
        ).filter(
            Project.organization_id == self.organization_id,
            Project.status == 'completed',
            Project.outcome.in_(['won', 'lost']),
            Project.created_at >= start_date,
            Project.created_at <= end_date
        ).group_by(getattr(Project, dimension))
        
        results = base_query.all()
        
        breakdown = []
        total_projects = 0
        total_wins = 0
        total_won_value = 0.0
        
        for r in results:
            key = r.group_key or 'Unknown'
            total = r.total_count
            wins = r.win_count
            losses = r.loss_count
            value = float(r.total_value or 0)
            won_value = float(r.won_value or 0)
            
            win_rate = (wins / total * 100) if total > 0 else 0
            
            breakdown.append({
                'label': key,
                'total_proposals': total,
                'wins': wins,
                'losses': losses,
                'win_rate': round(win_rate, 1),
                'won_value': won_value,
                'pipeline_value': value
            })
            
            total_projects += total
            total_wins += wins
            total_won_value += won_value
            
        # Sort by win rate desc
        breakdown.sort(key=lambda x: x['win_rate'], reverse=True)
        
        overall_win_rate = (total_wins / total_projects * 100) if total_projects > 0 else 0
        
        return {
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'overall': {
                'total_proposals': total_projects,
                'total_wins': total_wins,
                'win_rate': round(overall_win_rate, 1),
                'total_won_revenue': total_won_value
            },
            'breakdown': breakdown
        }
    
    def get_loss_reason_analysis(self) -> List[Dict[str, Any]]:
        """
        Analyze top reasons for losing proposals.
        """
        results = db.session.query(
            Project.loss_reason,
            func.count(Project.id).label('count')
        ).filter(
            Project.organization_id == self.organization_id,
            Project.outcome == 'lost',
            Project.loss_reason != None
        ).group_by(Project.loss_reason).order_by(desc('count')).all()
        
        return [
            {
                'reason': r.loss_reason,
                'count': r.count,
                # 'percentage': calculated later if needed
            }
            for r in results
        ]
    
    def get_revenue_trends(self, months: int = 12) -> List[Dict[str, Any]]:
        """
        Get monthly revenue trends (won vs lost opportunity).
        """
        start_date = datetime.utcnow() - timedelta(days=30*months)
        
        # Group by month
        results = db.session.query(
            func.date_trunc('month', Project.outcome_date).label('month'),
            func.sum(case((Project.outcome == 'won', Project.contract_value), else_=0)).label('won_revenue'),
            func.sum(case((Project.outcome == 'lost', Project.contract_value), else_=0)).label('lost_revenue')
        ).filter(
            Project.organization_id == self.organization_id,
            Project.status == 'completed',
            Project.outcome.in_(['won', 'lost']),
            Project.outcome_date >= start_date
        ).group_by('month').order_by('month').all()
        
        trends = []
        for r in results:
            if r.month:
                trends.append({
                    'month': r.month.strftime('%Y-%m'),
                    'won_revenue': float(r.won_revenue or 0),
                    'lost_revenue': float(r.lost_revenue or 0)
                })
        
        return trends


# Factory function
def get_win_loss_analytics_service(organization_id: int = None) -> WinLossAnalyticsService:
    return WinLossAnalyticsService(organization_id)
