"""
Time Savings Tracker Service

Tracks and calculates time saved by users through AI-powered features.
Provides metrics for user value proof ("You saved X hours this month").
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy import func

from app.models import db

logger = logging.getLogger(__name__)


# Average time estimates (in minutes) for manual tasks
TIME_ESTIMATES = {
    'question_extraction': 30,      # Manual reading and listing questions
    'answer_generation': 45,        # Writing a single answer from scratch
    'proposal_formatting': 60,      # Formatting entire proposal
    'compliance_check': 20,         # Manual compliance verification
    'document_analysis': 25,        # Analyzing RFP requirements
    'export_generation': 15,        # Manual export creation
}


class TimeSavingsTracker:
    """
    Tracks time saved by users through automation.
    
    Methodology:
    - Track each AI action (question extraction, answer generation, etc.)
    - Apply industry-standard time estimates for manual equivalent
    - Aggregate per user, project, and organization
    """
    
    def __init__(self, org_id: int = None, user_id: int = None):
        self.org_id = org_id
        self.user_id = user_id
    
    def record_action(
        self,
        action_type: str,
        project_id: int = None,
        item_count: int = 1,
        metadata: Dict = None
    ) -> Dict:
        """
        Record a time-saving action.
        
        Args:
            action_type: Type of action (question_extraction, answer_generation, etc.)
            project_id: Associated project ID
            item_count: Number of items processed (e.g., 15 questions)
            metadata: Additional context
            
        Returns:
            Dict with recorded action and time saved
        """
        try:
            base_time = TIME_ESTIMATES.get(action_type, 10)  # Default 10 min
            time_saved_minutes = base_time * item_count
            
            # Store in database
            from app.models.activity_log import ActivityLog
            
            log = ActivityLog(
                org_id=self.org_id,
                user_id=self.user_id,
                project_id=project_id,
                action_type=f"time_saved_{action_type}",
                details={
                    'action': action_type,
                    'item_count': item_count,
                    'time_saved_minutes': time_saved_minutes,
                    'metadata': metadata or {}
                }
            )
            db.session.add(log)
            db.session.commit()
            
            return {
                'success': True,
                'action_type': action_type,
                'time_saved_minutes': time_saved_minutes,
                'human_readable': self._format_time(time_saved_minutes)
            }
            
        except Exception as e:
            logger.error(f"Failed to record time saving: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_user_savings(
        self,
        period: str = 'month'
    ) -> Dict:
        """
        Get total time savings for the current user.
        
        Args:
            period: 'week', 'month', 'quarter', 'year', 'all'
            
        Returns:
            Dict with savings breakdown
        """
        try:
            from app.models.activity_log import ActivityLog
            
            # Calculate date range
            start_date = self._get_period_start(period)
            
            # Query activity logs
            query = ActivityLog.query.filter(
                ActivityLog.user_id == self.user_id,
                ActivityLog.action_type.like('time_saved_%')
            )
            
            if start_date:
                query = query.filter(ActivityLog.created_at >= start_date)
            
            logs = query.all()
            
            # Aggregate savings
            total_minutes = 0
            by_action = {}
            project_count = set()
            
            for log in logs:
                details = log.details or {}
                minutes = details.get('time_saved_minutes', 0)
                action = details.get('action', 'unknown')
                
                total_minutes += minutes
                by_action[action] = by_action.get(action, 0) + minutes
                
                if log.project_id:
                    project_count.add(log.project_id)
            
            return {
                'success': True,
                'period': period,
                'total_minutes': total_minutes,
                'total_hours': round(total_minutes / 60, 1),
                'human_readable': self._format_time(total_minutes),
                'by_action': by_action,
                'projects_helped': len(project_count),
                'equivalent_value': self._calculate_dollar_value(total_minutes)
            }
            
        except Exception as e:
            logger.error(f"Failed to get user savings: {e}")
            return {
                'success': False,
                'total_minutes': 0,
                'error': str(e)
            }
    
    def get_org_savings(self, period: str = 'month') -> Dict:
        """Get total time savings for the organization."""
        try:
            from app.models.activity_log import ActivityLog
            
            start_date = self._get_period_start(period)
            
            query = ActivityLog.query.filter(
                ActivityLog.org_id == self.org_id,
                ActivityLog.action_type.like('time_saved_%')
            )
            
            if start_date:
                query = query.filter(ActivityLog.created_at >= start_date)
            
            logs = query.all()
            
            total_minutes = 0
            by_user = {}
            
            for log in logs:
                details = log.details or {}
                minutes = details.get('time_saved_minutes', 0)
                total_minutes += minutes
                
                user_id = log.user_id
                by_user[user_id] = by_user.get(user_id, 0) + minutes
            
            return {
                'success': True,
                'period': period,
                'total_minutes': total_minutes,
                'total_hours': round(total_minutes / 60, 1),
                'human_readable': self._format_time(total_minutes),
                'team_members': len(by_user),
                'equivalent_value': self._calculate_dollar_value(total_minutes)
            }
            
        except Exception as e:
            logger.error(f"Failed to get org savings: {e}")
            return {'success': False, 'error': str(e)}
    
    def _get_period_start(self, period: str) -> Optional[datetime]:
        """Calculate start date for period."""
        now = datetime.utcnow()
        
        if period == 'week':
            return now - timedelta(days=7)
        elif period == 'month':
            return now - timedelta(days=30)
        elif period == 'quarter':
            return now - timedelta(days=90)
        elif period == 'year':
            return now - timedelta(days=365)
        else:
            return None  # All time
    
    def _format_time(self, minutes: int) -> str:
        """Format minutes to human-readable string."""
        if minutes < 60:
            return f"{minutes} minutes"
        
        hours = minutes // 60
        remaining_minutes = minutes % 60
        
        if remaining_minutes == 0:
            return f"{hours} hour{'s' if hours > 1 else ''}"
        
        return f"{hours}h {remaining_minutes}m"
    
    def _calculate_dollar_value(self, minutes: int, hourly_rate: int = 75) -> str:
        """Calculate dollar value of time saved (default $75/hr)."""
        hours = minutes / 60
        value = hours * hourly_rate
        return f"${value:,.0f}"


def get_time_savings_tracker(org_id: int = None, user_id: int = None) -> TimeSavingsTracker:
    """Factory function to get Time Savings Tracker."""
    return TimeSavingsTracker(org_id=org_id, user_id=user_id)
