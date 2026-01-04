"""
Compliance Service

Provides GDPR/SOC2 compliance features:
- User data export (GDPR Article 20)
- User data deletion (GDPR Article 17)
- Audit trail generation
- Data retention policies

Phase 3: Enterprise Ready
"""
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from io import BytesIO

logger = logging.getLogger(__name__)


class ComplianceService:
    """Service for GDPR and compliance-related features."""
    
    def __init__(self, organization_id: int = None):
        self.organization_id = organization_id
    
    def export_user_data(self, user_id: int) -> Dict[str, Any]:
        """
        Export all data associated with a user (GDPR Article 20).
        
        Returns a structured dict containing all user data that can
        be converted to JSON for download.
        
        Args:
            user_id: The user ID to export data for
        
        Returns:
            Dict containing all user data
        """
        from ..models import (
            User, Project, Question, Answer, 
            KnowledgeItem, AuditLog, Notification
        )
        
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        export_data = {
            'export_date': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'data_categories': {}
        }
        
        # Personal Information
        export_data['data_categories']['personal_info'] = {
            'name': user.name,
            'email': user.email,
            'role': user.role,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'organization_id': user.organization_id
        }
        
        # Projects created by user
        projects = Project.query.filter_by(created_by=user_id).all()
        export_data['data_categories']['projects'] = [
            {
                'id': p.id,
                'name': p.name,
                'status': p.status,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'client_name': p.client_name
            }
            for p in projects
        ]
        
        # Answers created by user
        answers = Answer.query.filter_by(created_by=user_id).all()
        export_data['data_categories']['answers'] = [
            {
                'id': a.id,
                'content': a.content[:500] if a.content else '',
                'status': a.status,
                'created_at': a.created_at.isoformat() if hasattr(a, 'created_at') and a.created_at else None
            }
            for a in answers
        ]
        
        # Knowledge items created by user
        knowledge_items = KnowledgeItem.query.filter_by(created_by=user_id).all()
        export_data['data_categories']['knowledge_items'] = [
            {
                'id': k.id,
                'title': k.title,
                'category': k.category,
                'created_at': k.created_at.isoformat() if k.created_at else None
            }
            for k in knowledge_items
        ]
        
        # Audit logs for user actions
        audit_logs = AuditLog.query.filter_by(user_id=user_id).order_by(AuditLog.created_at.desc()).limit(1000).all()
        export_data['data_categories']['activity_log'] = [
            {
                'action': log.action,
                'resource_type': log.resource_type,
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'ip_address': log.ip_address
            }
            for log in audit_logs
        ]
        
        # Notifications for user
        try:
            notifications = Notification.query.filter_by(user_id=user_id).all()
            export_data['data_categories']['notifications'] = [
                {
                    'id': n.id,
                    'message': n.message,
                    'read': n.read,
                    'created_at': n.created_at.isoformat() if n.created_at else None
                }
                for n in notifications
            ]
        except Exception:
            export_data['data_categories']['notifications'] = []
        
        logger.info(f"[GDPR] Exported data for user {user_id}")
        return export_data
    
    def delete_user_data(
        self, 
        user_id: int, 
        retain_anonymized: bool = True
    ) -> Dict[str, Any]:
        """
        Delete all personal data for a user (GDPR Article 17).
        
        Optionally retains anonymized data for analytics.
        
        Args:
            user_id: The user ID to delete data for
            retain_anonymized: If True, anonymize instead of delete for analytics
        
        Returns:
            Summary of deletion actions
        """
        from ..models import User, Answer, KnowledgeItem, AuditLog, Notification
        from ..extensions import db
        
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        deletion_summary = {
            'user_id': user_id,
            'deletion_date': datetime.utcnow().isoformat(),
            'actions': []
        }
        
        try:
            if retain_anonymized:
                # Anonymize user data instead of deleting
                user.name = f"Deleted User #{user_id}"
                user.email = f"deleted.{user_id}@anonymized.local"
                deletion_summary['actions'].append({
                    'type': 'anonymize',
                    'resource': 'user',
                    'count': 1
                })
                
                # Clear personal notification content
                notifications = Notification.query.filter_by(user_id=user_id).all()
                for n in notifications:
                    n.message = "[Deleted]"
                deletion_summary['actions'].append({
                    'type': 'clear',
                    'resource': 'notifications',
                    'count': len(notifications)
                })
                
            else:
                # Full deletion (cascade will handle related records)
                db.session.delete(user)
                deletion_summary['actions'].append({
                    'type': 'delete',
                    'resource': 'user',
                    'count': 1
                })
            
            # Create audit log for the deletion (required for compliance)
            AuditLog.log(
                action='gdpr_delete_request',
                resource_type='user',
                resource_id=user_id,
                user_id=user_id,
                organization_id=user.organization_id,
                details={
                    'retain_anonymized': retain_anonymized,
                    'deletion_summary': deletion_summary
                }
            )
            
            db.session.commit()
            logger.info(f"[GDPR] Deleted/anonymized data for user {user_id}")
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"[GDPR] Failed to delete user data: {e}")
            return {'error': str(e)}
        
        return deletion_summary
    
    def generate_audit_report(
        self,
        organization_id: int,
        start_date: datetime = None,
        end_date: datetime = None,
        resource_type: str = None
    ) -> Dict[str, Any]:
        """
        Generate compliance audit report for an organization.
        
        Args:
            organization_id: Organization to generate report for
            start_date: Start of report period (default: 30 days ago)
            end_date: End of report period (default: now)
            resource_type: Filter by resource type (optional)
        
        Returns:
            Audit report dict
        """
        from ..models import AuditLog, User
        
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()
        
        # Build query
        query = AuditLog.query.filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= start_date,
            AuditLog.created_at <= end_date
        )
        
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        
        logs = query.order_by(AuditLog.created_at.desc()).all()
        
        # Generate summary statistics
        action_counts = {}
        resource_counts = {}
        user_activity = {}
        
        for log in logs:
            # Count by action
            action_counts[log.action] = action_counts.get(log.action, 0) + 1
            
            # Count by resource type
            resource_counts[log.resource_type] = resource_counts.get(log.resource_type, 0) + 1
            
            # Count by user
            user_id = log.user_id or 'system'
            user_activity[user_id] = user_activity.get(user_id, 0) + 1
        
        # Get user names for top active users
        top_users = sorted(user_activity.items(), key=lambda x: x[1], reverse=True)[:10]
        user_ids = [u[0] for u in top_users if isinstance(u[0], int)]
        users = {u.id: u.name for u in User.query.filter(User.id.in_(user_ids)).all()}
        
        report = {
            'organization_id': organization_id,
            'report_period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'total_events': len(logs),
            'action_summary': action_counts,
            'resource_summary': resource_counts,
            'top_active_users': [
                {
                    'user_id': u[0],
                    'user_name': users.get(u[0], 'System') if isinstance(u[0], int) else 'System',
                    'action_count': u[1]
                }
                for u in top_users
            ],
            'generated_at': datetime.utcnow().isoformat()
        }
        
        logger.info(f"[COMPLIANCE] Generated audit report for org {organization_id}: {len(logs)} events")
        return report
    
    def get_data_retention_status(self, organization_id: int) -> Dict[str, Any]:
        """
        Get data retention policy status for an organization.
        
        Returns current retention settings and any data pending deletion.
        """
        from ..models import Project, KnowledgeItem
        
        # Default retention periods (could be configurable per org)
        retention_days = 365 * 2  # 2 years default
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # Count records past retention
        old_projects = Project.query.filter(
            Project.organization_id == organization_id,
            Project.created_at < cutoff_date,
            Project.status == 'completed'
        ).count()
        
        old_knowledge = KnowledgeItem.query.filter(
            KnowledgeItem.organization_id == organization_id,
            KnowledgeItem.created_at < cutoff_date,
            KnowledgeItem.is_active == False
        ).count()
        
        return {
            'organization_id': organization_id,
            'retention_period_days': retention_days,
            'cutoff_date': cutoff_date.isoformat(),
            'data_pending_retention_review': {
                'old_completed_projects': old_projects,
                'inactive_knowledge_items': old_knowledge
            },
            'checked_at': datetime.utcnow().isoformat()
        }


# Factory function
def get_compliance_service(organization_id: int = None) -> ComplianceService:
    """Get compliance service instance."""
    return ComplianceService(organization_id)
