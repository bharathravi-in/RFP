"""
Slack Integration Service for notifications.
"""
import requests
import logging
from flask import current_app

logger = logging.getLogger(__name__)


class SlackService:
    """Service for sending Slack webhook notifications."""
    
    def __init__(self, webhook_url: str = None):
        self.webhook_url = webhook_url or current_app.config.get('SLACK_WEBHOOK_URL')
        self.enabled = bool(self.webhook_url)
    
    def send_message(self, text: str, blocks: list = None) -> bool:
        """
        Send a message to Slack.
        
        Args:
            text: Fallback text for notifications
            blocks: Optional Slack Block Kit blocks for rich formatting
            
        Returns:
            True if sent successfully, False otherwise
        """
        if not self.enabled:
            logger.debug('Slack notifications disabled - no webhook URL')
            return False
        
        payload = {'text': text}
        if blocks:
            payload['blocks'] = blocks
        
        try:
            response = requests.post(
                self.webhook_url,
                json=payload,
                timeout=5
            )
            response.raise_for_status()
            return True
        except requests.RequestException as e:
            logger.error(f'Failed to send Slack message: {e}')
            return False
    
    def notify_answer_generated(
        self,
        project_name: str,
        question_text: str,
        confidence: float,
        project_url: str = None
    ) -> bool:
        """Send notification when an AI answer is generated."""
        emoji = '✅' if confidence >= 0.8 else '⚠️' if confidence >= 0.6 else '❌'
        confidence_pct = round(confidence * 100)
        
        blocks = [
            {
                'type': 'section',
                'text': {
                    'type': 'mrkdwn',
                    'text': f'{emoji} *New AI Answer Generated*\n\n*Project:* {project_name}'
                }
            },
            {
                'type': 'section',
                'text': {
                    'type': 'mrkdwn',
                    'text': f'*Question:* {question_text[:200]}...\n*Confidence:* {confidence_pct}%'
                }
            }
        ]
        
        if project_url:
            blocks.append({
                'type': 'actions',
                'elements': [{
                    'type': 'button',
                    'text': {'type': 'plain_text', 'text': 'Review Answer'},
                    'url': project_url,
                    'style': 'primary'
                }]
            })
        
        return self.send_message(
            f'New answer for "{question_text[:50]}..." ({confidence_pct}% confident)',
            blocks
        )
    
    def notify_review_needed(
        self,
        project_name: str,
        pending_count: int,
        reviewer_name: str = None,
        project_url: str = None
    ) -> bool:
        """Send notification when answers need review."""
        text = f'📋 *{pending_count} answers ready for review*'
        if reviewer_name:
            text = f'👋 {reviewer_name}, {text}'
        
        blocks = [
            {
                'type': 'section',
                'text': {
                    'type': 'mrkdwn',
                    'text': f'{text}\n\n*Project:* {project_name}'
                }
            }
        ]
        
        if project_url:
            blocks.append({
                'type': 'actions',
                'elements': [{
                    'type': 'button',
                    'text': {'type': 'plain_text', 'text': 'Start Review'},
                    'url': project_url,
                    'style': 'primary'
                }]
            })
        
        return self.send_message(
            f'{pending_count} answers need review in {project_name}',
            blocks
        )
    
    def notify_project_completed(
        self,
        project_name: str,
        total_questions: int,
        approved_answers: int,
        project_url: str = None
    ) -> bool:
        """Send notification when a project is completed."""
        blocks = [
            {
                'type': 'section',
                'text': {
                    'type': 'mrkdwn',
                    'text': f'🎉 *Project Completed!*\n\n*{project_name}*'
                }
            },
            {
                'type': 'section',
                'fields': [
                    {'type': 'mrkdwn', 'text': f'*Questions:*\n{total_questions}'},
                    {'type': 'mrkdwn', 'text': f'*Approved:*\n{approved_answers}'},
                ]
            }
        ]
        
        if project_url:
            blocks.append({
                'type': 'actions',
                'elements': [{
                    'type': 'button',
                    'text': {'type': 'plain_text', 'text': 'Export Project'},
                    'url': project_url
                }]
            })
        
        return self.send_message(
            f'Project "{project_name}" completed with {approved_answers}/{total_questions} approved',
            blocks
        )


# Singleton getter
def get_slack_service() -> SlackService:
    """Get Slack service instance."""
    return SlackService()
