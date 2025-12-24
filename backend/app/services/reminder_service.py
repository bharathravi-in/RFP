"""
Reminder Service for deadline notifications.

Handles detection of upcoming deadlines and sending reminder emails.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict
from flask import current_app

logger = logging.getLogger(__name__)


class ReminderService:
    """Service for managing project deadline reminders."""
    
    # Reminder intervals in days before due date
    REMINDER_INTERVALS = [7, 3, 1, 0]  # 7 days, 3 days, 1 day, due today
    
    def __init__(self):
        self.frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
    
    def get_upcoming_deadlines(self, org_id: int, days_ahead: int = 14) -> List[Dict]:
        """
        Get projects with upcoming deadlines.
        
        Args:
            org_id: Organization ID
            days_ahead: How many days ahead to look
            
        Returns:
            List of projects with deadline info
        """
        from app.models import Project
        
        today = datetime.utcnow().date()
        cutoff = today + timedelta(days=days_ahead)
        
        projects = Project.query.filter(
            Project.organization_id == org_id,
            Project.due_date.isnot(None),
            Project.status.notin_(['completed', 'cancelled']),
            Project.due_date <= cutoff
        ).order_by(Project.due_date.asc()).all()
        
        deadlines = []
        for project in projects:
            due_date = project.due_date.date() if hasattr(project.due_date, 'date') else project.due_date
            days_remaining = (due_date - today).days
            
            deadlines.append({
                'project_id': project.id,
                'project_name': project.name,
                'due_date': project.due_date.isoformat() if project.due_date else None,
                'days_remaining': days_remaining,
                'status': project.status,
                'completion_percent': project.completion_percent or 0,
                'urgency': self._get_urgency(days_remaining),
                'created_by': project.created_by,
                'client_name': project.client_name,
            })
        
        return deadlines
    
    def _get_urgency(self, days_remaining: int) -> str:
        """Determine urgency level based on days remaining."""
        if days_remaining < 0:
            return 'overdue'
        elif days_remaining == 0:
            return 'due_today'
        elif days_remaining <= 2:
            return 'critical'
        elif days_remaining <= 7:
            return 'warning'
        else:
            return 'normal'
    
    def check_and_send_reminders(self, org_id: int = None) -> Dict:
        """
        Check all projects for due dates and send reminders.
        
        Args:
            org_id: If provided, only check this organization
            
        Returns:
            Summary of reminders sent
        """
        from app.models import Project, User, Notification
        from app.services.email_service import get_email_service
        from app.extensions import db
        
        today = datetime.utcnow().date()
        reminders_sent = 0
        projects_checked = 0
        
        # Query projects needing reminders
        query = Project.query.filter(
            Project.due_date.isnot(None),
            Project.status.notin_(['completed', 'cancelled'])
        )
        
        if org_id:
            query = query.filter(Project.organization_id == org_id)
        
        projects = query.all()
        email_service = get_email_service()
        
        for project in projects:
            projects_checked += 1
            due_date = project.due_date.date() if hasattr(project.due_date, 'date') else project.due_date
            days_remaining = (due_date - today).days
            
            # Check if we should send a reminder
            if days_remaining not in self.REMINDER_INTERVALS and days_remaining >= 0:
                continue
            
            # Get project owner
            owner = User.query.get(project.created_by)
            if not owner or not owner.email:
                continue
            
            # Determine reminder type
            if days_remaining < 0:
                reminder_type = 'overdue'
                subject = f"⚠️ OVERDUE: {project.name}"
            elif days_remaining == 0:
                reminder_type = 'due_today'
                subject = f"📅 Due Today: {project.name}"
            elif days_remaining == 1:
                reminder_type = 'due_tomorrow'
                subject = f"⏰ Due Tomorrow: {project.name}"
            elif days_remaining == 3:
                reminder_type = 'due_soon'
                subject = f"📋 Due in 3 Days: {project.name}"
            else:  # 7 days
                reminder_type = 'upcoming'
                subject = f"📋 Upcoming: {project.name} due in 7 days"
            
            # Create in-app notification
            notification = Notification(
                user_id=owner.id,
                organization_id=project.organization_id,
                type='deadline_reminder',
                title=subject,
                message=f"Project '{project.name}' deadline is {'overdue!' if days_remaining < 0 else 'today!' if days_remaining == 0 else f'in {days_remaining} days.'} Completion: {project.completion_percent:.0f}%",
                related_id=project.id,
                related_type='project'
            )
            db.session.add(notification)
            
            # Send email reminder
            try:
                self._send_deadline_email(
                    email_service=email_service,
                    to=owner.email,
                    owner_name=owner.name,
                    project=project,
                    days_remaining=days_remaining,
                    reminder_type=reminder_type
                )
                reminders_sent += 1
            except Exception as e:
                logger.error(f"Failed to send reminder email for project {project.id}: {e}")
        
        db.session.commit()
        
        return {
            'projects_checked': projects_checked,
            'reminders_sent': reminders_sent,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _send_deadline_email(
        self,
        email_service,
        to: str,
        owner_name: str,
        project,
        days_remaining: int,
        reminder_type: str
    ):
        """Send deadline reminder email."""
        project_url = f"{self.frontend_url}/projects/{project.id}"
        
        # Determine urgency styling
        if reminder_type == 'overdue':
            urgency_color = '#DC2626'
            urgency_text = f'{abs(days_remaining)} days overdue'
        elif reminder_type == 'due_today':
            urgency_color = '#DC2626'
            urgency_text = 'Due Today'
        elif reminder_type == 'due_tomorrow':
            urgency_color = '#F59E0B'
            urgency_text = 'Due Tomorrow'
        else:
            urgency_color = '#3B82F6'
            urgency_text = f'{days_remaining} days remaining'
        
        html_body = f"""
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">RFP Pro</h1>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                    Hi {owner_name},
                </p>
                
                <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 18px;">
                        {project.name}
                    </h2>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                        <div style="background: {urgency_color}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">
                            {urgency_text}
                        </div>
                        <div style="color: #6B7280; font-size: 14px;">
                            Completion: {project.completion_percent:.0f}%
                        </div>
                    </div>
                    {'<p style="color: #DC2626; margin-top: 12px; font-weight: 500;">⚠️ This project is overdue!</p>' if reminder_type == 'overdue' else ''}
                </div>
                
                <a href="{project_url}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                    View Project
                </a>
                
                <p style="color: #9CA3AF; font-size: 12px; margin-top: 32px;">
                    You're receiving this because you're the project owner. 
                    <a href="{self.frontend_url}/settings" style="color: #4F46E5;">Manage notification preferences</a>
                </p>
            </div>
        </div>
        """
        
        text_body = f"""
        RFP Pro - Deadline Reminder
        
        Hi {owner_name},
        
        Project: {project.name}
        Status: {urgency_text}
        Completion: {project.completion_percent:.0f}%
        
        View project: {project_url}
        """
        
        subject = f"{'⚠️ OVERDUE' if reminder_type == 'overdue' else '📅'} {project.name} - Deadline Reminder"
        
        email_service.send_email(
            to=[to],
            subject=subject,
            html_body=html_body,
            text_body=text_body
        )


def get_reminder_service():
    """Get reminder service instance."""
    return ReminderService()
