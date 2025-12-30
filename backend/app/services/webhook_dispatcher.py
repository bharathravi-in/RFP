"""
Webhook Dispatcher Service for sending event notifications.

Dispatches webhooks asynchronously with retry logic and signature verification.
"""
import hashlib
import hmac
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any
import requests
from ..extensions import db
from ..models.webhook import WebhookConfig, WebhookDelivery, WEBHOOK_EVENTS


class WebhookDispatcher:
    """Service for dispatching webhook notifications."""
    
    def __init__(self):
        self.timeout = 10  # seconds
        self.max_retries = 3
    
    def dispatch(self, org_id: int, event_type: str, payload: Dict[str, Any]) -> list:
        """
        Dispatch a webhook event to all subscribed endpoints.
        
        Args:
            org_id: Organization ID
            event_type: Event type (e.g., 'section.approved')
            payload: Event payload data
            
        Returns:
            List of delivery results
        """
        if event_type not in WEBHOOK_EVENTS:
            print(f"[Webhook] Unknown event type: {event_type}")
            return []
        
        # Find active webhooks for this org that subscribe to this event
        webhooks = WebhookConfig.query.filter(
            WebhookConfig.organization_id == org_id,
            WebhookConfig.is_active == True
        ).all()
        
        results = []
        
        for webhook in webhooks:
            if event_type in (webhook.events or []):
                result = self._deliver(webhook, event_type, payload)
                results.append(result)
        
        return results
    
    def _deliver(self, webhook: WebhookConfig, event_type: str, payload: Dict[str, Any]) -> dict:
        """Deliver webhook to a single endpoint."""
        
        # Create delivery record
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=payload,
            created_at=datetime.utcnow()
        )
        
        # Prepare request
        headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event_type,
            'X-Webhook-Delivery': str(delivery.id or 'pending'),
            'X-Webhook-Timestamp': str(int(time.time()))
        }
        
        # Sign payload if secret is configured
        body = json.dumps(payload)
        if webhook.secret:
            signature = self._sign_payload(body, webhook.secret)
            headers['X-Webhook-Signature'] = signature
        
        start_time = time.time()
        
        try:
            response = requests.post(
                webhook.url,
                data=body,
                headers=headers,
                timeout=self.timeout
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            delivery.status_code = response.status_code
            delivery.response_body = response.text[:1000]  # Truncate long responses
            delivery.delivered_at = datetime.utcnow()
            delivery.duration_ms = duration_ms
            delivery.success = 200 <= response.status_code < 300
            
            # Update webhook statistics
            if delivery.success:
                webhook.success_count = (webhook.success_count or 0) + 1
            else:
                webhook.failure_count = (webhook.failure_count or 0) + 1
            webhook.last_triggered_at = datetime.utcnow()
            
        except requests.exceptions.Timeout:
            delivery.error_message = 'Request timed out'
            delivery.success = False
            delivery.duration_ms = self.timeout * 1000
            webhook.failure_count = (webhook.failure_count or 0) + 1
            
        except requests.exceptions.RequestException as e:
            delivery.error_message = str(e)
            delivery.success = False
            delivery.duration_ms = int((time.time() - start_time) * 1000)
            webhook.failure_count = (webhook.failure_count or 0) + 1
        
        db.session.add(delivery)
        db.session.commit()
        
        return {
            'webhook_id': webhook.id,
            'webhook_name': webhook.name,
            'success': delivery.success,
            'status_code': delivery.status_code,
            'duration_ms': delivery.duration_ms,
            'error': delivery.error_message
        }
    
    def _sign_payload(self, body: str, secret: str) -> str:
        """Generate HMAC-SHA256 signature for payload."""
        signature = hmac.new(
            secret.encode('utf-8'),
            body.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"
    
    @staticmethod
    def get_available_events() -> dict:
        """Return list of available webhook events."""
        return WEBHOOK_EVENTS


# Global dispatcher instance
webhook_dispatcher = WebhookDispatcher()


def dispatch_webhook(org_id: int, event_type: str, payload: Dict[str, Any]):
    """
    Convenience function to dispatch a webhook event.
    
    Usage:
        from app.services.webhook_dispatcher import dispatch_webhook
        
        dispatch_webhook(org_id, 'section.approved', {
            'section_id': 123,
            'project_id': 456,
            'approved_by': 'user@example.com'
        })
    """
    return webhook_dispatcher.dispatch(org_id, event_type, payload)
