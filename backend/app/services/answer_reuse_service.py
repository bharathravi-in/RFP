"""
Answer Reuse Service

Enables approved answers to be suggested for similar questions,
implementing continuous learning from past responses.
"""
import logging
from datetime import datetime
from typing import List, Dict, Optional
from flask import current_app

logger = logging.getLogger(__name__)


class AnswerReuseService:
    """Service for reusing approved answers and learning from past responses."""
    
    SIMILARITY_THRESHOLD = 0.75  # Minimum similarity for suggestions
    HIGH_SIMILARITY_THRESHOLD = 0.90  # Auto-suggest threshold
    
    def find_similar_answers(
        self,
        question_text: str,
        org_id: int,
        category: str = None,
        limit: int = 3
    ) -> List[Dict]:
        """
        Find previously approved answers for similar questions.
        
        Args:
            question_text: The question to find similar answers for
            org_id: Organization ID
            category: Optional category filter
            limit: Maximum number of results
        
        Returns:
            List of dicts with:
            - question_id: Original question ID
            - question_text: The original question
            - answer_content: The approved answer
            - similarity_score: How similar the questions are
            - answer_id: The answer ID
            - category: Question category
        """
        try:
            from .qdrant_service import get_qdrant_service
            from ..models import Answer, Question
            
            qdrant = get_qdrant_service()
            
            if not qdrant.enabled:
                logger.debug("Qdrant not enabled, falling back to keyword search")
                return self._keyword_similar_search(question_text, org_id, category, limit)
            
            # Search in the knowledge base for approved answers
            results = qdrant.search(
                query=question_text,
                org_id=org_id,
                limit=limit * 2,  # Get extra to filter
                score_threshold=self.SIMILARITY_THRESHOLD
            )
            
            # Filter and enrich results
            enriched = []
            for r in results:
                # Check if this is an approved answer source
                item_metadata = r.get('metadata', {})
                answer_id = item_metadata.get('answer_id')
                
                if not answer_id:
                    continue
                
                answer = Answer.query.get(answer_id)
                if not answer or answer.status != 'approved':
                    continue
                
                question = answer.question
                if not question:
                    continue
                
                # Apply category filter if specified
                if category and question.category != category:
                    continue
                
                enriched.append({
                    'question_id': question.id,
                    'question_text': question.text,
                    'answer_content': answer.content,
                    'similarity_score': round(r['score'], 4),
                    'answer_id': answer.id,
                    'category': question.category,
                    'approved_at': answer.reviewed_at.isoformat() if answer.reviewed_at else None
                })
                
                if len(enriched) >= limit:
                    break
            
            return enriched
            
        except Exception as e:
            logger.error(f"Similar answer search failed: {e}")
            return []
    
    def _keyword_similar_search(
        self,
        question_text: str,
        org_id: int,
        category: str = None,
        limit: int = 3
    ) -> List[Dict]:
        """Fallback keyword-based similar question search."""
        from ..models import Question, Answer
        from ..extensions import db
        from sqlalchemy import func
        
        try:
            # Extract key terms from question
            stop_words = {'the', 'a', 'an', 'is', 'are', 'do', 'does', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'your', 'you', 'we', 'our', 'can', 'will', 'would', 'could', 'should', 'please', 'describe', 'explain', 'provide'}
            words = [w.lower().strip('?.,!') for w in question_text.split() if len(w) > 2]
            key_terms = [w for w in words if w not in stop_words][:10]
            
            if not key_terms:
                return []
            
            # Build query for approved answers
            query = db.session.query(Question, Answer).join(
                Answer, Answer.question_id == Question.id
            ).filter(
                Answer.status == 'approved',
                Question.project.has(organization_id=org_id)
            )
            
            if category:
                query = query.filter(Question.category == category)
            
            # Score by keyword matches
            results = []
            for question, answer in query.all():
                question_lower = question.text.lower()
                matches = sum(1 for term in key_terms if term in question_lower)
                
                if matches >= 2:  # At least 2 keyword matches
                    score = matches / len(key_terms)
                    results.append({
                        'question_id': question.id,
                        'question_text': question.text,
                        'answer_content': answer.content,
                        'similarity_score': round(score, 4),
                        'answer_id': answer.id,
                        'category': question.category,
                        'approved_at': answer.reviewed_at.isoformat() if answer.reviewed_at else None
                    })
            
            # Sort by score and limit
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Keyword similar search failed: {e}")
            return []
    
    def store_approved_answer(self, answer_id: int) -> bool:
        """
        Store an approved answer in the reuse index.
        
        Called when an answer is approved to enable future reuse.
        
        Args:
            answer_id: ID of the approved answer
        
        Returns:
            True if successful, False otherwise
        """
        from ..models import Answer, KnowledgeItem
        from ..extensions import db
        
        answer = Answer.query.get(answer_id)
        if not answer or answer.status != 'approved':
            return False
        
        question = answer.question
        if not question:
            return False
        
        org_id = question.project.organization_id
        
        try:
            # First, add to vector database for semantic search
            from .qdrant_service import get_qdrant_service
            qdrant = get_qdrant_service()
            
            if qdrant.enabled:
                # Create combined text for embedding
                combined_text = f"Question: {question.text}\n\nAnswer: {answer.content}"
                
                qdrant.upsert_item(
                    item_id=answer.id,
                    org_id=org_id,
                    title=question.text[:200],
                    content=combined_text,
                    metadata={
                        'answer_id': answer.id,
                        'question_id': question.id,
                        'category': question.category,
                        'source_type': 'approved_answer',
                        'approved_at': answer.reviewed_at.isoformat() if answer.reviewed_at else None
                    }
                )
            
            # Also add to knowledge base for RAG context
            self._add_to_knowledge_base(answer)
            
            logger.info(f"Stored approved answer {answer_id} for reuse")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store approved answer: {e}")
            return False
    
    def _add_to_knowledge_base(self, answer) -> Optional[int]:
        """Add approved answer to knowledge base as a reusable item."""
        from ..models import KnowledgeItem
        from ..extensions import db
        
        question = answer.question
        org_id = question.project.organization_id
        
        # Check if already exists
        existing = KnowledgeItem.query.filter_by(
            organization_id=org_id,
            source_type='approved_answer'
        ).filter(
            KnowledgeItem.item_metadata['answer_id'].astext == str(answer.id)
        ).first()
        
        if existing:
            # Update existing entry
            existing.content = answer.content
            existing.updated_at = datetime.utcnow()
            db.session.commit()
            return existing.id
        
        # Create new knowledge item
        item = KnowledgeItem(
            title=f"Q: {question.text[:150]}..." if len(question.text) > 150 else f"Q: {question.text}",
            content=f"Question: {question.text}\n\nApproved Answer: {answer.content}",
            tags=[question.category] if question.category else [],
            category=question.category,
            source_type='approved_answer',
            item_metadata={
                'answer_id': answer.id,
                'question_id': question.id,
                'project_id': question.project_id
            },
            organization_id=org_id,
            created_by=answer.reviewed_by or 1,
            is_active=True
        )
        
        db.session.add(item)
        db.session.commit()
        
        return item.id
    
    def suggest_template(
        self,
        question_text: str,
        org_id: int,
        category: str = None
    ) -> Optional[Dict]:
        """
        Suggest a template answer based on highly similar approved answers.
        
        Args:
            question_text: The question to find a template for
            org_id: Organization ID
            category: Optional category filter
        
        Returns:
            Template suggestion if found, None otherwise
        """
        similar = self.find_similar_answers(question_text, org_id, category, limit=1)
        
        if similar and similar[0]['similarity_score'] >= self.HIGH_SIMILARITY_THRESHOLD:
            return {
                'suggested_answer': similar[0]['answer_content'],
                'source_question': similar[0]['question_text'],
                'source_answer_id': similar[0]['answer_id'],
                'similarity': similar[0]['similarity_score'],
                'category': similar[0]['category'],
                'note': 'This is a template from a highly similar approved answer. Please review and customize as needed.'
            }
        
        return None
    
    def track_answer_usage(self, answer_id: int, used_for_question_id: int):
        """
        Track when an approved answer is reused or referenced.
        
        Updates usage statistics for the source knowledge item.
        """
        from ..models import KnowledgeItem
        from ..extensions import db
        
        try:
            # Find the knowledge item for this answer
            item = KnowledgeItem.query.filter_by(
                source_type='approved_answer'
            ).filter(
                KnowledgeItem.item_metadata['answer_id'].astext == str(answer_id)
            ).first()
            
            if item:
                item.usage_count = (item.usage_count or 0) + 1
                item.last_used_at = datetime.utcnow()
                db.session.commit()
                
        except Exception as e:
            logger.error(f"Failed to track answer usage: {e}")
    
    def get_most_reused_answers(self, org_id: int, limit: int = 10) -> List[Dict]:
        """
        Get the most frequently reused approved answers.
        
        Useful for identifying institutional knowledge.
        """
        from ..models import KnowledgeItem, Answer
        
        try:
            items = KnowledgeItem.query.filter_by(
                organization_id=org_id,
                source_type='approved_answer',
                is_active=True
            ).filter(
                KnowledgeItem.usage_count > 0
            ).order_by(
                KnowledgeItem.usage_count.desc()
            ).limit(limit).all()
            
            return [
                {
                    'knowledge_item_id': item.id,
                    'title': item.title,
                    'usage_count': item.usage_count,
                    'last_used_at': item.last_used_at.isoformat() if item.last_used_at else None,
                    'category': item.category,
                    'answer_id': item.item_metadata.get('answer_id')
                }
                for item in items
            ]
            
        except Exception as e:
            logger.error(f"Failed to get most reused answers: {e}")
            return []


# Singleton instance
answer_reuse_service = AnswerReuseService()
