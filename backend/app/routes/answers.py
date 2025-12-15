from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Answer, AnswerComment, Question, User

bp = Blueprint('answers', __name__)


@bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_answer():
    """Generate AI answer for a question."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    data = request.get_json()
    question_id = data.get('question_id')
    
    if not question_id:
        return jsonify({'error': 'Question ID required'}), 400
    
    question = Question.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get generation options
    options = data.get('options', {})
    tone = options.get('tone', 'professional')
    length = options.get('length', 'medium')
    
    # TODO: Call AI service
    # from ..services.ai_service import generate_ai_answer
    # result = generate_ai_answer(question.text, tone=tone, length=length)
    
    # Placeholder response
    result = {
        'content': f'[AI Generated Answer for: {question.text[:100]}...]',
        'confidence_score': 0.85,
        'sources': [
            {'title': 'Company Policy Doc', 'relevance': 0.92},
            {'title': 'Previous RFP Response', 'relevance': 0.87}
        ]
    }
    
    # Determine version
    current_version = Answer.query.filter_by(question_id=question_id).count()
    
    answer = Answer(
        content=result['content'],
        confidence_score=result['confidence_score'],
        sources=result['sources'],
        status='draft',
        version=current_version + 1,
        is_ai_generated=True,
        generation_params={'tone': tone, 'length': length},
        question_id=question_id
    )
    
    db.session.add(answer)
    
    # Update question status
    question.status = 'answered'
    
    db.session.commit()
    
    return jsonify({
        'message': 'Answer generated',
        'answer': answer.to_dict()
    }), 201


@bp.route('/regenerate', methods=['POST'])
@jwt_required()
def regenerate_answer():
    """Regenerate answer with different options."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    data = request.get_json()
    answer_id = data.get('answer_id')
    action = data.get('action', 'regenerate')  # regenerate, shorten, expand, improve_tone
    
    if not answer_id:
        return jsonify({'error': 'Answer ID required'}), 400
    
    answer = Answer.query.get(answer_id)
    
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    if answer.question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # TODO: Call AI service with action
    # new_content = ai_service.modify_answer(answer.content, action)
    
    # Create new version
    new_answer = Answer(
        content=f'[{action.upper()}]: {answer.content}',
        confidence_score=answer.confidence_score,
        sources=answer.sources,
        status='draft',
        version=answer.version + 1,
        is_ai_generated=True,
        generation_params={'action': action, 'based_on': answer.id},
        question_id=answer.question_id
    )
    
    db.session.add(new_answer)
    db.session.commit()
    
    return jsonify({
        'message': f'Answer {action}d',
        'answer': new_answer.to_dict()
    }), 201


@bp.route('/<int:answer_id>', methods=['PUT'])
@jwt_required()
def update_answer(answer_id):
    """Edit answer content."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor', 'reviewer']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    answer = Answer.query.get(answer_id)
    
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    if answer.question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'content' in data:
        answer.content = data['content']
        answer.is_ai_generated = False  # Mark as human-edited
    
    db.session.commit()
    
    return jsonify({
        'message': 'Answer updated',
        'answer': answer.to_dict()
    }), 200


@bp.route('/<int:answer_id>/review', methods=['PUT'])
@jwt_required()
def review_answer(answer_id):
    """Approve or reject an answer."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'reviewer']:
        return jsonify({'error': 'Reviewer access required'}), 403
    
    answer = Answer.query.get(answer_id)
    
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    if answer.question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    action = data.get('action')  # approve, reject
    notes = data.get('notes', '')
    
    if action not in ['approve', 'reject']:
        return jsonify({'error': 'Action must be approve or reject'}), 400
    
    answer.status = 'approved' if action == 'approve' else 'rejected'
    answer.review_notes = notes
    answer.reviewed_by = user_id
    answer.reviewed_at = datetime.utcnow()
    
    # Update question status
    if action == 'approve':
        answer.question.status = 'approved'
    elif action == 'reject':
        answer.question.status = 'answered'  # Back to editing
    
    db.session.commit()
    
    return jsonify({
        'message': f'Answer {action}d',
        'answer': answer.to_dict()
    }), 200


@bp.route('/<int:answer_id>/comment', methods=['POST'])
@jwt_required()
def add_comment(answer_id):
    """Add inline comment to answer."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    answer = Answer.query.get(answer_id)
    
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404
    
    if answer.question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if not data.get('content'):
        return jsonify({'error': 'Comment content required'}), 400
    
    comment = AnswerComment(
        content=data['content'],
        position=data.get('position'),  # Selection range in editor
        answer_id=answer_id,
        user_id=user_id
    )
    
    db.session.add(comment)
    db.session.commit()
    
    return jsonify({
        'message': 'Comment added',
        'comment': comment.to_dict()
    }), 201


@bp.route('/comments/<int:comment_id>', methods=['PUT'])
@jwt_required()
def resolve_comment(comment_id):
    """Resolve or update a comment."""
    user_id = get_jwt_identity()
    
    comment = AnswerComment.query.get(comment_id)
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    data = request.get_json()
    
    if 'resolved' in data:
        comment.resolved = data['resolved']
    if 'content' in data and comment.user_id == user_id:
        comment.content = data['content']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Comment updated',
        'comment': comment.to_dict()
    }), 200
