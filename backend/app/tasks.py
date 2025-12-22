"""
Celery Tasks for async processing.

Handles background jobs like embedding creation and reindexing.
"""
import logging
from celery_worker import celery
from app.extensions import db

logger = logging.getLogger(__name__)


@celery.task(bind=True, max_retries=3)
def create_embedding_task(self, item_id: int, org_id: int):
    """
    Create embedding for a knowledge item in background.
    
    Args:
        item_id: Knowledge item ID
        org_id: Organization ID
    """
    try:
        from app.models import KnowledgeItem
        from app.services.qdrant_service import get_qdrant_service
        
        item = KnowledgeItem.query.get(item_id)
        if not item:
            logger.warning(f"Knowledge item {item_id} not found")
            return {'status': 'not_found', 'item_id': item_id}
        
        qdrant = get_qdrant_service()
        if not qdrant.enabled:
            logger.warning("Qdrant service not available")
            return {'status': 'qdrant_unavailable', 'item_id': item_id}
        
        embedding_id = qdrant.upsert_item(
            item_id=item.id,
            org_id=org_id,
            title=item.title,
            content=item.content,
            folder_id=item.folder_id,
            tags=item.tags or [],
            geography=item.geography,
            client_type=item.client_type,
            industry=item.industry,
            knowledge_profile_id=item.knowledge_profile_id
        )
        
        if embedding_id:
            item.embedding_id = embedding_id
            db.session.commit()
            logger.info(f"Created embedding for item {item_id}: {embedding_id}")
            return {'status': 'success', 'item_id': item_id, 'embedding_id': embedding_id}
        
        return {'status': 'no_embedding', 'item_id': item_id}
        
    except Exception as e:
        logger.error(f"Failed to create embedding for item {item_id}: {e}")
        self.retry(countdown=60, exc=e)


@celery.task(bind=True)
def delete_embedding_task(self, item_id: int, org_id: int):
    """
    Delete embedding from Qdrant in background.
    
    Args:
        item_id: Knowledge item ID
        org_id: Organization ID
    """
    try:
        from app.services.qdrant_service import get_qdrant_service
        
        qdrant = get_qdrant_service()
        if not qdrant.enabled:
            return {'status': 'qdrant_unavailable'}
        
        success = qdrant.delete_item(item_id=item_id, org_id=org_id)
        
        return {'status': 'success' if success else 'failed', 'item_id': item_id}
        
    except Exception as e:
        logger.error(f"Failed to delete embedding for item {item_id}: {e}")
        return {'status': 'error', 'error': str(e)}


@celery.task(bind=True)
def reindex_org_knowledge_task(self, org_id: int):
    """
    Reindex all knowledge items for an organization in background.
    
    Args:
        org_id: Organization ID
    """
    try:
        from app.models import KnowledgeItem
        from app.services.qdrant_service import get_qdrant_service
        
        qdrant = get_qdrant_service()
        if not qdrant.enabled:
            return {'status': 'qdrant_unavailable', 'org_id': org_id}
        
        items = KnowledgeItem.query.filter_by(
            organization_id=org_id,
            is_active=True
        ).all()
        
        items_data = [{
            'id': item.id,
            'title': item.title,
            'content': item.content,
            'folder_id': item.folder_id,
            'tags': item.tags or []
        } for item in items]
        
        count = qdrant.reindex_all(items=items_data, org_id=org_id)
        
        logger.info(f"Reindexed {count} items for org {org_id}")
        return {'status': 'success', 'org_id': org_id, 'count': count}
        
    except Exception as e:
        logger.error(f"Failed to reindex org {org_id}: {e}")
        return {'status': 'error', 'error': str(e)}


@celery.task
def search_knowledge_for_answer(query: str, org_id: int, limit: int = 5):
    """
    Search knowledge base for relevant context when generating answers.
    
    Args:
        query: Question text to search for
        org_id: Organization ID
        limit: Max results to return
        
    Returns:
        List of relevant knowledge item content
    """
    try:
        from app.services.qdrant_service import get_qdrant_service
        from app.models import KnowledgeItem
        
        qdrant = get_qdrant_service()
        if not qdrant.enabled:
            return []
        
        results = qdrant.search(
            query=query,
            org_id=org_id,
            limit=limit
        )
        
        # Fetch full content from database
        if results:
            item_ids = [r['item_id'] for r in results]
            items = KnowledgeItem.query.filter(
                KnowledgeItem.id.in_(item_ids)
            ).all()
            items_map = {item.id: item for item in items}
            
            return [{
                'title': items_map[r['item_id']].title if r['item_id'] in items_map else r['title'],
                'content': items_map[r['item_id']].content if r['item_id'] in items_map else r['content_preview'],
                'score': r['score']
            } for r in results if r['item_id'] in items_map]
        
        return []
        
    except Exception as e:
        logger.error(f"Knowledge search failed: {e}")
        return []


@celery.task(bind=True)
def check_deadlines_task(self, org_id: int = None):
    """
    Check all projects for upcoming deadlines and send reminders.
    
    This task should be scheduled to run daily (e.g., at 9 AM).
    
    Args:
        org_id: If provided, only check this organization
        
    Returns:
        Summary of reminders sent
    """
    try:
        from flask import Flask
        from app import create_app
        from app.services.reminder_service import get_reminder_service
        
        # Create app context if needed
        app = create_app()
        with app.app_context():
            reminder_service = get_reminder_service()
            result = reminder_service.check_and_send_reminders(org_id=org_id)
            
            logger.info(
                f"Deadline check complete: {result['reminders_sent']} reminders sent, "
                f"{result['projects_checked']} projects checked"
            )
            return result
            
    except Exception as e:
        logger.error(f"Deadline check failed: {e}")
        return {'status': 'error', 'error': str(e)}


# Schedule: Run deadline check daily at 9 AM UTC
# Add to celery beat schedule in celery_worker.py:
# celery.conf.beat_schedule = {
#     'check-deadlines-daily': {
#         'task': 'app.tasks.check_deadlines_task',
#         'schedule': crontab(hour=9, minute=0),
#     },
# }

