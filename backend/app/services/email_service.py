"""
Email Notification Service.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app
from typing import List, Optional

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending email notifications."""
    
    def __init__(self):
        self.smtp_host = current_app.config.get('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = current_app.config.get('SMTP_PORT', 587)
        self.smtp_user = current_app.config.get('SMTP_USER')
        self.smtp_password = current_app.config.get('SMTP_PASSWORD')
        self.from_email = current_app.config.get('FROM_EMAIL', 'noreply@autorespond.ai')
        self.enabled = bool(self.smtp_user and self.smtp_password)
    
    def send_email(
        self,
        to: List[str],
        subject: str,
        html_body: str,
        text_body: str = None
    ) -> bool:
        """
        Send an email.
        
        Args:
            to: List of recipient email addresses
            subject: Email subject
            html_body: HTML content
            text_body: Plain text fallback
            
        Returns:
            True if sent successfully
        """
        if not self.enabled:
            logger.debug('Email notifications disabled - no SMTP credentials')
            return False
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = ', '.join(to)
            
            if text_body:
                msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to, msg.as_string())
            
            return True
        except Exception as e:
            logger.error(f'Failed to send email: {e}')
            return False
    
    def send_review_invitation(
        self,
        to: str,
        reviewer_name: str,
        project_name: str,
        assigner_name: str,
        project_url: str
    ) -> bool:
        """Send review invitation email."""
        subject = f'Review Requested: {project_name}'
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0;">Review Requested</h1>
            </div>
            <div style="padding: 32px; background: #f9fafb;">
                <p>Hi {reviewer_name},</p>
                <p><strong>{assigner_name}</strong> has assigned you as a reviewer for:</p>
                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6366f1;">
                    <h2 style="margin: 0 0 8px 0; color: #1a1a2e;">{project_name}</h2>
                </div>
                <a href="{project_url}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                    Start Reviewing
                </a>
            </div>
            <div style="padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
                AutoRespond AI
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Hi {reviewer_name},

        {assigner_name} has assigned you as a reviewer for: {project_name}

        Click here to start reviewing: {project_url}

        - AutoRespond AI
        """
        
        return self.send_email([to], subject, html_body, text_body)
    
    def send_answer_feedback(
        self,
        to: str,
        author_name: str,
        commenter_name: str,
        question_text: str,
        comment_text: str,
        project_url: str
    ) -> bool:
        """Send notification about new comment on answer."""
        subject = 'New Comment on Your Answer'
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="padding: 32px; background: #f9fafb;">
                <p>Hi {author_name},</p>
                <p><strong>{commenter_name}</strong> commented on your answer:</p>
                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="color: #6b7280; margin: 0 0 12px 0;">Question:</p>
                    <p style="margin: 0 0 16px 0;">{question_text[:200]}...</p>
                    <p style="color: #6b7280; margin: 0 0 12px 0;">Comment:</p>
                    <p style="margin: 0; padding: 12px; background: #fef3c7; border-radius: 6px;">{comment_text}</p>
                </div>
                <a href="{project_url}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                    View Comment
                </a>
            </div>
        </body>
        </html>
        """
        
        return self.send_email([to], subject, html_body)
    
    def send_project_completed(
        self,
        to: List[str],
        project_name: str,
        total_questions: int,
        approved_answers: int
    ) -> bool:
        """Send project completion notification."""
        subject = f'Project Completed: {project_name}'
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0;">🎉 Project Completed!</h1>
            </div>
            <div style="padding: 32px; background: #f9fafb; text-align: center;">
                <h2 style="color: #1a1a2e;">{project_name}</h2>
                <div style="display: flex; justify-content: center; gap: 24px; margin: 24px 0;">
                    <div style="background: white; padding: 16px 24px; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #1a1a2e;">{total_questions}</div>
                        <div style="color: #6b7280;">Questions</div>
                    </div>
                    <div style="background: white; padding: 16px 24px; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #10b981;">{approved_answers}</div>
                        <div style="color: #6b7280;">Approved</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to, subject, html_body)
    
    def send_team_invitation(
        self,
        to: str,
        inviter_name: str,
        organization_name: str,
        role: str,
        invite_link: str
    ) -> bool:
        """Send team invitation email."""
        subject = f'You\'re invited to join {organization_name} on RFP Pro'
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
            </div>
            <div style="padding: 40px; background: white;">
                <p style="font-size: 16px; color: #374151;">Hi there,</p>
                <p style="font-size: 16px; color: #374151;">
                    <strong>{inviter_name}</strong> has invited you to join <strong>{organization_name}</strong> on RFP Pro as a <strong>{role}</strong>.
                </p>
                <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                    <p style="margin: 0 0 16px 0; color: #6b7280;">Click the button below to accept the invitation:</p>
                    <a href="{invite_link}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                        Accept Invitation
                    </a>
                </div>
                <p style="font-size: 14px; color: #9ca3af;">
                    This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                </p>
            </div>
            <div style="padding: 24px; text-align: center; color: #9ca3af; font-size: 12px; background: #f9fafb;">
                <p style="margin: 0;">RFP Pro - AI-Powered RFP Responses</p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Hi there,

{inviter_name} has invited you to join {organization_name} on RFP Pro as a {role}.

Click here to accept the invitation: {invite_link}

This invitation will expire in 7 days.

- RFP Pro Team
        """
        
        return self.send_email([to], subject, html_body, text_body)


def get_email_service() -> EmailService:
    """Get email service instance."""
    return EmailService()

