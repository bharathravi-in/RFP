"""
AI Enhancement Routes for quality scoring and improvements.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Question, Answer, Project

bp = Blueprint('ai', __name__)


@bp.route('/score/<int:answer_id>', methods=['GET'])
@jwt_required()
def score_answer(answer_id):
    """Get quality score for an answer."""
    from ..services.quality_service import get_quality_scorer
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    answer = Answer.query.get(answer_id)
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    question = answer.question
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    scorer = get_quality_scorer()
    sources = answer.sources if answer.sources else []
    
    score_result = scorer.score_answer(
        question.text,
        answer.content,
        sources
    )
    
    return jsonify({
        'answer_id': answer_id,
        'scores': score_result
    }), 200


@bp.route('/improve/<int:answer_id>', methods=['POST'])
@jwt_required()
def improve_answer(answer_id):
    """Auto-improve an answer based on quality scores."""
    from ..services.quality_service import get_quality_scorer
    from ..services.improve_service import get_answer_improver
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    answer = Answer.query.get(answer_id)
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    question = answer.question
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    mode = data.get('mode')  # Optional: 'expand', 'concise', 'formal', etc.
    
    improver = get_answer_improver()
    
    if mode:
        # Mode-based improvement
        result = improver.improve_with_mode(
            question.text,
            answer.content,
            mode
        )
    else:
        # Auto-improve based on quality scores
        scorer = get_quality_scorer()
        quality_scores = scorer.score_answer(question.text, answer.content)
        
        result = improver.auto_improve(
            question.text,
            answer.content,
            quality_scores
        )
    
    if 'error' in result:
        return jsonify({'error': result['error']}), 400
    
    # Optionally save the improved version
    if data.get('save', False):
        improved_text = result.get('improved_answer') or result.get('regenerated_answer')
        if improved_text:
            answer.content = improved_text
            answer.version += 1
            db.session.commit()
    
    return jsonify({
        'answer_id': answer_id,
        'improvement': result
    }), 200


@bp.route('/regenerate/<int:answer_id>', methods=['POST'])
@jwt_required()
def regenerate_with_context(answer_id):
    """Regenerate answer with additional context or feedback."""
    from ..services.improve_service import get_answer_improver
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    answer = Answer.query.get(answer_id)
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    question = answer.question
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    if not data.get('context'):
        return jsonify({'error': 'Additional context required'}), 400
    
    improver = get_answer_improver()
    result = improver.regenerate_with_context(
        question.text,
        answer.content,
        data['context'],
        data.get('feedback')
    )
    
    if 'error' in result:
        return jsonify({'error': result['error']}), 400
    
    # Optionally save
    if data.get('save', False):
        answer.content = result['regenerated_answer']
        answer.version += 1
        db.session.commit()
    
    return jsonify({
        'answer_id': answer_id,
        'result': result
    }), 200


@bp.route('/batch-score/<int:project_id>', methods=['GET'])
@jwt_required()
def batch_score_project(project_id):
    """Score all answers in a project."""
    from ..services.quality_service import get_quality_scorer
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    scorer = get_quality_scorer()
    results = []
    
    for question in project.questions:
        if question.answer:
            score = scorer.score_answer(
                question.text,
                question.answer.content
            )
            results.append({
                'question_id': question.id,
                'answer_id': question.answer.id,
                'overall_score': score['overall_score'],
                'flags': score.get('flags', [])
            })
    
    # Calculate project averages
    if results:
        avg_score = sum(r['overall_score'] for r in results) / len(results)
        low_quality_count = sum(1 for r in results if r['overall_score'] < 0.6)
    else:
        avg_score = 0
        low_quality_count = 0
    
    return jsonify({
        'project_id': project_id,
        'total_scored': len(results),
        'average_score': round(avg_score, 3),
        'low_quality_count': low_quality_count,
        'results': results
    }), 200
