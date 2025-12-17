"""
Feedback API Routes

Provides endpoints for submitting feedback and viewing analytics.
"""
from flask import Blueprint, request, jsonify
import logging

from app.services.feedback_service import feedback_service
from app.models import AnswerEdit, AnswerFeedback, AgentPerformance
from app.extensions import db

logger = logging.getLogger(__name__)

feedback_bp = Blueprint('feedback', __name__, url_prefix='/api/feedback')


@feedback_bp.route('/answer-edit', methods=['POST'])
def submit_answer_edit():
    """
    Submit user edit to an AI-generated answer.
    
    Request body:
    {
        "answer_id": 123,
        "original_content": "...",
        "edited_content": "...",
        "user_id": 456,
        "edit_type": "minor_fix",  // optional
        "question_category": "security"  // optional
    }
    """
    try:
        data = request.get_json() or {}
        
        required = ['answer_id', 'original_content', 'edited_content', 'user_id']
        if not all(k in data for k in required):
            return jsonify({"error": "Missing required fields"}), 400
        
        edit = feedback_service.track_answer_edit(
            answer_id=data['answer_id'],
            original_content=data['original_content'],
            edited_content=data['edited_content'],
            user_id=data['user_id'],
            edit_type=data.get('edit_type'),
            question_category=data.get('question_category')
        )
        
        return jsonify({
            "success": True,
            "edit": edit.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to submit answer edit: {e}")
        return jsonify({"error": str(e)}), 500


@feedback_bp.route('/answer-rating', methods=['POST'])
def submit_answer_rating():
    """
    Submit quality rating for an answer.
    
    Request body:
    {
        "answer_id": 123,
        "user_id": 456,
        "rating": 4,  // 1-5
        "feedback_type": "helpful",  // optional
        "comment": "Great answer!",  // optional
        "question_category": "technical"  // optional
    }
    """
    try:
        data = request.get_json() or {}
        
        required = ['answer_id', 'user_id', 'rating']
        if not all(k in data for k in required):
            return jsonify({"error": "Missing required fields"}), 400
        
        rating = data['rating']
        if not (1 <= rating <= 5):
            return jsonify({"error": "Rating must be between 1 and 5"}), 400
        
        feedback = feedback_service.submit_answer_feedback(
            answer_id=data['answer_id'],
            user_id=data['user_id'],
            rating=rating,
            feedback_type=data.get('feedback_type'),
            comment=data.get('comment'),
            question_category=data.get('question_category')
        )
        
        return jsonify({
            "success": True,
            "feedback": feedback.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to submit rating: {e}")
        return jsonify({"error": str(e)}), 500


@feedback_bp.route('/analytics/edits', methods=['GET'])
def get_edit_analytics():
    """
    Get analytics on user edits.
    
    Query params:
        category: Filter by question category
        days: Number of days to analyze (default: 30)
    """
    try:
        category = request.args.get('category')
        days = int(request.args.get('days', 30))
        
        analytics = feedback_service.get_edit_analytics(
            category=category,
            days=days
        )
        
        return jsonify({
            "success": True,
            "analytics": analytics
        })
        
    except Exception as e:
        logger.error(f"Failed to get edit analytics: {e}")
        return jsonify({"error": str(e)}), 500


@feedback_bp.route('/analytics/ratings', methods=['GET'])
def get_rating_analytics():
    """
    Get analytics on answer ratings.
    
    Query params:
        category: Filter by question category
        days: Number of days to analyze (default: 30)
    """
    try:
        category = request.args.get('category')
        days = int(request.args.get('days', 30))
        
        analytics = feedback_service.get_feedback_analytics(
            category=category,
            days=days
        )
        
        return jsonify({
            "success": True,
            "analytics": analytics
        })
        
    except Exception as e:
        logger.error(f"Failed to get rating analytics: {e}")
        return jsonify({"error": str(e)}), 500


@feedback_bp.route('/analytics/agent-performance', methods=['GET'])
def get_agent_performance():
    """
    Get agent performance metrics.
    
    Query params:
        agent_name: Filter by agent (optional)
        project_id: Filter by project (optional) 
        days: Number of days (default: 7)
    """
    try:
        agent_name = request.args.get('agent_name')
        project_id = request.args.get('project_id', type=int)
        days = int(request.args.get('days', 7))
        
        from datetime import datetime, timedelta
        since = datetime.utcnow() - timedelta(days=days)
        
        query = db.session.query(AgentPerformance).filter(
            AgentPerformance.created_at >= since
        )
        
        if agent_name:
            query = query.filter(AgentPerformance.agent_name == agent_name)
        if project_id:
            query = query.filter(AgentPerformance.project_id == project_id)
        
        metrics = query.all()
        
        # Calculate stats
        total = len(metrics)
        success_count = sum(1 for m in metrics if m.success)
        avg_time = sum(m.execution_time_ms for m in metrics if m.execution_time_ms) / total if total > 0 else 0
        
        return jsonify({
            "success": True,
            "metrics": {
                "total_executions": total,
                "successful": success_count,
                "failed": total - success_count,
                "success_rate": success_count / total if total > 0 else 0,
                "avg_execution_time_ms": avg_time,
                "period_days": days
            },
            "recent_logs": [m.to_dict() for m in metrics[:50]]
        })
        
    except Exception as e:
        logger.error(f"Failed to get agent performance: {e}")
        return jsonify({"error": str(e)}), 500


@feedback_bp.route('/recommendations', methods=['GET'])
def get_improvement_recommendations():
    """
    Get improvement recommendations based on feedback.
    
    Query params:
        category: Filter by question category (optional)
    """
    try:
        category = request.args.get('category')
        
        recommendations = feedback_service.get_improvement_recommendations(
            category=category
        )
        
        return jsonify({
            "success": True,
            "recommendations": recommendations,
            "count": len(recommendations)
        })
        
    except Exception as e:
        logger.error(f"Failed to get recommendations: {e}")
        return jsonify({"error": str(e)}), 500
