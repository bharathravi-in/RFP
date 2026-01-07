"""
Email Notification Service

Handles email notifications for enterprise features:
- Approval workflow notifications
- Project status updates
- Deadline reminders

Phase 3: Enterprise Ready
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class EmailNotificationService:
    """Service for sending email notifications."""
    
    def __init__(self, organization_id: int = None):
        self.organization_id = organization_id
        self._smtp_config = None
    
    def _get_smtp_config(self) -> Optional[Dict]:
        """Get SMTP configuration from organization settings."""
        if self._smtp_config:
            return self._smtp_config
        
        if self.organization_id:
            try:
                from ..models import Organization
                org = Organization.query.get(self.organization_id)
                if org and org.settings:
                    self._smtp_config = org.settings.get('smtp_config', {})
            except Exception as e:
                logger.warning(f"Could not load SMTP config: {e}")
        
        return self._smtp_config or {}
    
    def send_approval_pending_email(
        self,
        approver_email: str,
        approver_name: str,
        project_name: str,
        project_id: int,
        stage_name: str,
        submitter_name: str,
        request_id: int
    ) -> bool:
        """
        Send email notification when approval is pending.
        
        Args:
            approver_email: Email address of the approver
            approver_name: Name of the approver
            project_name: Name of the project awaiting approval
            project_id: ID of the project
            stage_name: Current approval stage name
            submitter_name: Name of person who submitted for approval
            request_id: Approval request ID
        
        Returns:
            True if email sent successfully
        """
        subject = f"[RFP Pro] Approval Required: {project_name}"
        
        body = f"""
Hello {approver_name},

A proposal requires your approval.

**Project:** {project_name}
**Stage:** {stage_name}
**Submitted by:** {submitter_name}

Please review and make your decision in RFP Pro:
[View Approval Request](/approvals/{request_id})

---
This is an automated notification from RFP Pro.
"""
        
        return self._send_email(
            to_email=approver_email,
            subject=subject,
            body=body,
            notification_type='approval_pending'
        )
    
    def send_approval_decision_email(
        self,
        submitter_email: str,
        submitter_name: str,
        project_name: str,
        decision: str,  # 'approved' or 'rejected'
        approver_name: str,
        comments: str = None
    ) -> bool:
        """
        Send email notification when approval decision is made.
        
        Args:
            submitter_email: Email of the person who submitted
            submitter_name: Name of the submitter
            project_name: Name of the project
            decision: 'approved' or 'rejected'
            approver_name: Name of the approver who made decision
            comments: Optional comments from approver
        
        Returns:
            True if email sent successfully
        """
        decision_text = "Approved ✅" if decision == 'approved' else "Rejected ❌"
        subject = f"[RFP Pro] Proposal {decision_text}: {project_name}"
        
        body = f"""
Hello {submitter_name},

Your proposal "{project_name}" has been **{decision}**.

**Decision by:** {approver_name}
"""
        
        if comments:
            body += f"\n**Comments:** {comments}\n"
        
        body += """
---
This is an automated notification from RFP Pro.
"""
        
        return self._send_email(
            to_email=submitter_email,
            subject=subject,
            body=body,
            notification_type='approval_decision'
        )
    
    def send_deadline_reminder_email(
        self,
        user_email: str,
        user_name: str,
        project_name: str,
        due_date: datetime,
        days_remaining: int
    ) -> bool:
        """Send deadline reminder email."""
        subject = f"[RFP Pro] Deadline Reminder: {project_name} - {days_remaining} days"
        
        body = f"""
Hello {user_name},

This is a reminder that the proposal "{project_name}" is due in **{days_remaining} days**.

**Due Date:** {due_date.strftime('%B %d, %Y')}

Please ensure all sections are complete before the deadline.

---
This is an automated notification from RFP Pro.
"""
        
        return self._send_email(
            to_email=user_email,
            subject=subject,
            body=body,
            notification_type='deadline_reminder'
        )
    
    def _send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        notification_type: str
    ) -> bool:
        """
        Send an email using configured SMTP.
        
        In production, this would connect to SMTP server.
        For now, logs the email for debugging.
        """
        smtp_config = self._get_smtp_config()
        
        if not smtp_config.get('enabled'):
            # Log for development - would send in production
            logger.info(f"[EMAIL] Would send '{notification_type}' to {to_email}")
            logger.debug(f"[EMAIL] Subject: {subject}")
            logger.debug(f"[EMAIL] Body: {body[:200]}...")
            return True
        
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = smtp_config.get('from_email', 'noreply@rfppro.com')
            msg['To'] = to_email
            
            # Plain text part
            msg.attach(MIMEText(body, 'plain'))
            
            # Connect and send
            server = smtplib.SMTP(
                smtp_config.get('host', 'localhost'),
                smtp_config.get('port', 587)
            )
            
            if smtp_config.get('use_tls', True):
                server.starttls()
            
            if smtp_config.get('username'):
                server.login(
                    smtp_config['username'],
                    smtp_config.get('password', '')
                )
            
            server.sendmail(
                smtp_config.get('from_email', 'noreply@rfppro.com'),
                [to_email],
                msg.as_string()
            )
            server.quit()
            
            logger.info(f"[EMAIL] Sent '{notification_type}' to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"[EMAIL] Failed to send '{notification_type}' to {to_email}: {e}")
            return False
    
    def notify_stage_approvers(
        self,
        approval_request,
        stage
    ) -> int:
        """
        Notify all approvers for a stage.
        
        Args:
            approval_request: The ApprovalRequest object
            stage: The ApprovalStage object
        
        Returns:
            Number of notifications sent
        """
        from ..models import User
        
        sent_count = 0
        approvers = []
        
        # Get approvers based on stage configuration
        if stage.approver_type == 'user' and stage.approver_user_id:
            approvers = [User.query.get(stage.approver_user_id)]
        elif stage.approver_type == 'role' and stage.approver_role:
            approvers = User.query.filter_by(
                organization_id=approval_request.organization_id,
                role=stage.approver_role
            ).all()
        elif stage.approver_type == 'manager':
            # Get submitter's manager
            submitter = approval_request.submitter
            if submitter and hasattr(submitter, 'manager_id') and submitter.manager_id:
                approvers = [User.query.get(submitter.manager_id)]
        
        # Send notification to each approver
        for approver in approvers:
            if approver and approver.email:
                success = self.send_approval_pending_email(
                    approver_email=approver.email,
                    approver_name=approver.name,
                    project_name=approval_request.project.name,
                    project_id=approval_request.project_id,
                    stage_name=stage.name,
                    submitter_name=approval_request.submitter.name if approval_request.submitter else 'Unknown',
                    request_id=approval_request.id
                )
                if success:
                    sent_count += 1
        
        return sent_count


# Singleton instance
_email_service = None

def get_email_notification_service(organization_id: int = None) -> EmailNotificationService:
    """Get email notification service instance."""
    global _email_service
    if _email_service is None or _email_service.organization_id != organization_id:
        _email_service = EmailNotificationService(organization_id)
    return _email_service
