"""
Feedback Service

Tracks user edits, quality ratings, and agent performance for continuous improvement.
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from Levenshtein import distance as levenshtein_distance

from app.extensions import db
from app.models import AnswerEdit, AnswerFeedback, AgentPerformance, Answer

logger = logging.getLogger(__name__)


class FeedbackService:
    """Service for tracking and analyzing feedback on AI-generated answers."""
    
    @staticmethod
    def track_answer_edit(
        answer_id: int,
        original_content: str,
        edited_content: str,
        user_id: int,
        edit_type: str = None,
        question_category: str = None
    ) -> AnswerEdit:
        """
        Track a user edit to an AI-generated answer.
        
        Args:
            answer_id: ID of the answer being edited
            original_content: Original AI-generated content
            edited_content: User-edited content
            user_id: ID of user making the edit
            edit_type: Type of edit (minor_fix, major_rewrite, etc.)
            question_category: Category of the question
            
        Returns:
            Created AnswerEdit record
        """
        try:
            # Calculate edit distance
            edit_dist = levenshtein_distance(original_content, edited_content)
            
            # Get answer for context
            answer = Answer.query.get(answer_id)
            confidence_before = answer.confidence_score if answer else None
            
            # Create edit record
            edit = AnswerEdit(
                answer_id=answer_id,
                user_id=user_id,
                original_content=original_content,
                edited_content=edited_content,
                edit_distance=edit_dist,
                edit_type=edit_type or FeedbackService._classify_edit_type(edit_dist, len(original_content)),
                category=question_category,
                confidence_before=confidence_before
            )
            
            db.session.add(edit)
            db.session.commit()
            
            logger.info(f"Tracked edit for answer {answer_id}: {edit_dist} character changes")
            return edit
            
        except Exception as e:
            logger.error(f"Failed to track answer edit: {e}")
            db.session.rollback()
            raise
    
    @staticmethod
    def _classify_edit_type(edit_distance: int, original_length: int) -> str:
        """Classify edit type based on edit distance."""
        if original_length == 0:
            return 'complete_rewrite'
        
        change_ratio = edit_distance / original_length
        
        if change_ratio < 0.1:
            return 'minor_fix'
        elif change_ratio < 0.3:
            return 'moderate_edit'
        elif change_ratio < 0.7:
            return 'major_rewrite'
        else:
            return 'complete_rewrite'
    
    @staticmethod
    def submit_answer_feedback(
        answer_id: int,
        user_id: int,
        rating: int,
        feedback_type: str = None,
        comment: str = None,
        question_category: str = None
    ) -> AnswerFeedback:
        """
        Submit quality feedback on an answer.
        
        Args:
            answer_id: ID of the answer
            user_id: ID of user giving feedback
            rating: 1-5 star rating
            feedback_type: Type of feedback (helpful, needs_work, etc.)
            comment: Optional comment
            question_category: Category of question
            
        Returns:
            Created AnswerFeedback record
        """
        try:
            feedback = AnswerFeedback(
                answer_id=answer_id,
                user_id=user_id,
                rating=rating,
                feedback_type=feedback_type,
                comment=comment,
                question_category=question_category
            )
            
            db.session.add(feedback)
            db.session.commit()
            
            logger.info(f"Recorded feedback for answer {answer_id}: {rating} stars")
            return feedback
            
        except Exception as e:
            logger.error(f"Failed to submit feedback: {e}")
            db.session.rollback()
            raise
    
    @staticmethod
    def track_agent_performance(
        agent_name: str,
        step_name: str,
        execution_time_ms: int,
        success: bool = True,
        project_id: int = None,
        error_message: str = None,
        context_data: Dict = None
    ) -> AgentPerformance:
        """
        Track agent execution performance.
        
        Args:
            agent_name: Name of the agent
            step_name: Workflow step identifier
            execution_time_ms: Execution time in milliseconds
            success: Whether execution succeeded
            project_id: Associated project ID
            error_message: Error message if failed
            context_data: Additional context data
            
        Returns:
            Created AgentPerformance record
        """
        try:
            perf = AgentPerformance(
                agent_name=agent_name,
                step_name=step_name,
                execution_time_ms=execution_time_ms,
                success=success,
                project_id=project_id,
                error_message=error_message,
                context_data=context_data or {}
            )
            
            db.session.add(perf)
            db.session.commit()
            
            return perf
            
        except Exception as e:
            logger.error(f"Failed to track agent performance: {e}")
            db.session.rollback()
            raise
    
    @staticmethod
    def get_edit_analytics(
        agent_name: str = None,
        category: str = None,
        days: int = 30
    ) -> Dict:
        """
        Get analytics on user edits.
        
        Args:
            agent_name: Filter by agent (optional)
            category: Filter by question category (optional)
            days: Number of days to analyze
            
        Returns:
            Analytics dictionary
        """
        try:
            since = datetime.utcnow() - timedelta(days=days)
            
            query = db.session.query(AnswerEdit).filter(AnswerEdit.created_at >= since)
            
            if category:
                query = query.filter(AnswerEdit.category == category)
            
            edits = query.all()
            
            if not edits:
                return {
                    'total_edits': 0,
                    'avg_edit_distance': 0,
                    'edit_types': {},
                    'categories': {}
                }
            
            # Calculate stats
            edit_types = {}
            categories = {}
            total_distance = 0
            
            for edit in edits:
                total_distance += edit.edit_distance or 0
                
                edit_type = edit.edit_type or 'unknown'
                edit_types[edit_type] = edit_types.get(edit_type, 0) + 1
                
                cat = edit.category or 'unknown'
                categories[cat] = categories.get(cat, 0) + 1
            
            return {
                'total_edits': len(edits),
                'avg_edit_distance': total_distance / len(edits) if edits else 0,
                'edit_types': edit_types,
                'categories': categories,
                'period_days': days
            }
            
        except Exception as e:
            logger.error(f"Failed to get edit analytics: {e}")
            return {}
    
    @staticmethod
    def get_feedback_analytics(category: str = None, days: int = 30) -> Dict:
        """Get analytics on answer feedback ratings."""
        try:
            since = datetime.utcnow() - timedelta(days=days)
            
            query = db.session.query(AnswerFeedback).filter(AnswerFeedback.created_at >= since)
            
            if category:
                query = query.filter(AnswerFeedback.question_category == category)
            
            feedback_items = query.all()
            
            if not feedback_items:
                return {
                    'total_feedback': 0,
                    'avg_rating': 0,
                    'rating_distribution': {},
                    'feedback_types': {}
                }
            
            # Calculate stats
            total_rating = 0
            rating_dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            feedback_types = {}
            
            for feedback in feedback_items:
                total_rating += feedback.rating
                rating_dist[feedback.rating] += 1
                
                if feedback.feedback_type:
                    feedback_types[feedback.feedback_type] = feedback_types.get(feedback.feedback_type, 0) + 1
            
            return {
                'total_feedback': len(feedback_items),
                'avg_rating': total_rating / len(feedback_items),
                'rating_distribution': rating_dist,
                'feedback_types': feedback_types,
                'period_days': days
            }
            
        except Exception as e:
            logger.error(f"Failed to get feedback analytics: {e}")
            return {}
    
    @staticmethod
    def get_improvement_recommendations(category: str = None) -> List[Dict]:
        """
        Generate improvement recommendations based on feedback.
        
        Returns list of recommendations with priority and description.
        """
        try:
            edit_analytics = FeedbackService.get_edit_analytics(category=category)
            feedback_analytics = FeedbackService.get_feedback_analytics(category=category)
            
            recommendations = []
            
            # High edit distance = answers need improvement
            if edit_analytics.get('avg_edit_distance', 0) > 100:
                recommendations.append({
                    'priority': 'high',
                    'type': 'answer_quality',
                    'description': f"High edit distance ({edit_analytics['avg_edit_distance']:.0f}) suggests answers need significant user revision",
                    'suggestion': 'Review and improve answer generation prompts',
                    'category': category
                })
            
            # Low ratings = poor quality
            if feedback_analytics.get('avg_rating', 0) < 3.0:
                recommendations.append({
                    'priority': 'critical',
                    'type': 'low_ratings',
                    'description': f"Low average rating ({feedback_analytics['avg_rating']:.1f}/5)",
                    'suggestion': 'Urgent review of AI prompts and knowledge base quality',
                    'category': category
                })
            
            # Lots of major rewrites
            edit_types = edit_analytics.get('edit_types', {})
            if edit_types.get('major_rewrite', 0) > edit_types.get('minor_fix', 0):
                recommendations.append({
                    'priority': 'medium',
                    'type': 'major_edits',
                    'description': 'Users are making major rewrites more often than minor fixes',
                    'suggestion': 'Review prompt specificity and knowledge base coverage',
                    'category': category
                })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate recommendations: {e}")
            return []


# Singleton instance
feedback_service = FeedbackService()
