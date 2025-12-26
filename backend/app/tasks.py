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


@celery.task(bind=True, max_retries=3)
def process_document_embeddings_task(self, document_id: int, org_id: int):
    """
    Background task to process document embeddings.
    
    This task:
    1. Downloads document from storage
    2. Chunks document using Docling (page-based)
    3. Generates dense + sparse embeddings for each chunk
    4. Stores chunks in Qdrant with full metadata
    5. Updates document status in database
    
    Args:
        document_id: Document database ID
        org_id: Organization ID
    """
    from datetime import datetime
    
    try:
        from app.models import Document
        from app.services.storage_service import get_storage_service
        from app.services.docling_chunking_service import get_docling_chunking_service
        from app.services.hybrid_search_service import get_hybrid_search_service
        
        # Get document
        document = Document.query.get(document_id)
        if not document:
            logger.warning(f"Document {document_id} not found")
            return {'status': 'not_found', 'document_id': document_id}
        
        # Update status to processing
        document.embedding_status = 'processing'
        document.embedding_started_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Starting embedding processing for document {document_id}: {document.original_filename}")
        
        # Get file path (from storage or local)
        storage = get_storage_service()
        
        try:
            if document.file_id:
                file_path = storage.get_local_path(document.file_id)
            elif document.file_path:
                file_path = document.file_path
            else:
                raise ValueError("No file path or file_id available")
        except Exception as e:
            logger.error(f"Failed to get file path for document {document_id}: {e}")
            document.embedding_status = 'failed'
            document.error_message = f"Failed to access file: {e}"
            db.session.commit()
            return {'status': 'file_error', 'error': str(e)}
        
        # Chunk document
        chunking_service = get_docling_chunking_service()
        
        try:
            chunking_result = chunking_service.chunk_document(
                file_path=file_path,
                file_id=document.file_id or str(document.id),
                doc_url=document.file_url,
                original_filename=document.original_filename,
                file_type=document.file_type
            )
        except Exception as e:
            logger.error(f"Failed to chunk document {document_id}: {e}")
            document.embedding_status = 'failed'
            document.error_message = f"Chunking failed: {e}"
            db.session.commit()
            return {'status': 'chunking_error', 'error': str(e)}
        
        logger.info(f"Document {document_id} chunked into {chunking_result.total_chunks} chunks")
        
        # Store chunks in Qdrant
        hybrid_search = get_hybrid_search_service(org_id)
        
        if not hybrid_search.enabled:
            logger.warning("Qdrant/Hybrid search not available")
            document.embedding_status = 'failed'
            document.error_message = "Vector database not available"
            db.session.commit()
            return {'status': 'qdrant_unavailable'}
        
        try:
            indexed_count = hybrid_search.upsert_document_chunks(
                chunks=chunking_result.chunks,
                org_id=org_id
            )
        except Exception as e:
            logger.error(f"Failed to index chunks for document {document_id}: {e}")
            document.embedding_status = 'failed'
            document.error_message = f"Indexing failed: {e}"
            db.session.commit()
            return {'status': 'indexing_error', 'error': str(e)}
        
        # Update document with results
        document.embedding_status = 'completed'
        document.embedding_completed_at = datetime.utcnow()
        document.chunk_count = indexed_count
        document.page_count = chunking_result.total_pages
        document.word_count = chunking_result.total_words
        document.file_metadata = {
            **(document.file_metadata or {}),
            'chunking_result': {
                'total_chunks': chunking_result.total_chunks,
                'total_pages': chunking_result.total_pages,
                'total_words': chunking_result.total_words,
                'processing_time_ms': chunking_result.processing_time_ms,
                'extraction_method': chunking_result.document_metadata.get('extraction_method', 'unknown')
            }
        }
        document.error_message = None
        db.session.commit()
        
        logger.info(
            f"Document {document_id} embedding completed: "
            f"{indexed_count} chunks, {chunking_result.total_pages} pages"
        )
        
        return {
            'status': 'success',
            'document_id': document_id,
            'chunks_indexed': indexed_count,
            'pages': chunking_result.total_pages,
            'words': chunking_result.total_words
        }
        
    except Exception as e:
        logger.error(f"Failed to process embeddings for document {document_id}: {e}")
        
        # Update status on failure
        try:
            document = Document.query.get(document_id)
            if document:
                document.embedding_status = 'failed'
                document.error_message = str(e)
                db.session.commit()
        except:
            pass
        
        # Retry on transient errors
        self.retry(countdown=120, exc=e)


@celery.task(bind=True)
def delete_document_embeddings_task(self, file_id: str, org_id: int):
    """
    Delete all embeddings for a document from Qdrant.
    
    Args:
        file_id: Document file ID
        org_id: Organization ID
    """
    try:
        from app.services.hybrid_search_service import get_hybrid_search_service
        
        hybrid_search = get_hybrid_search_service(org_id)
        if not hybrid_search.enabled:
            return {'status': 'qdrant_unavailable'}
        
        success = hybrid_search.delete_document_chunks(file_id, org_id)
        
        logger.info(f"Deleted embeddings for document {file_id}: {success}")
        return {'status': 'success' if success else 'failed', 'file_id': file_id}
        
    except Exception as e:
        logger.error(f"Failed to delete embeddings for {file_id}: {e}")
        return {'status': 'error', 'error': str(e)}


@celery.task(bind=True)
def reprocess_document_embeddings_task(self, document_id: int, org_id: int):
    """
    Reprocess embeddings for a document (delete old + create new).
    
    Args:
        document_id: Document database ID
        org_id: Organization ID
    """
    try:
        from app.models import Document
        
        document = Document.query.get(document_id)
        if not document:
            return {'status': 'not_found'}
        
        # Delete existing embeddings
        if document.file_id:
            delete_document_embeddings_task.delay(document.file_id, org_id)
        
        # Process new embeddings
        return process_document_embeddings_task(document_id, org_id)
        
    except Exception as e:
        logger.error(f"Failed to reprocess document {document_id}: {e}")
        return {'status': 'error', 'error': str(e)}

