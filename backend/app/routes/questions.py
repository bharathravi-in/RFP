from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Question, Project, User

bp = Blueprint('questions', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def list_questions():
    """List questions for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project_id = request.args.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    questions = Question.query.filter_by(
        project_id=project_id
    ).order_by(Question.order).all()
    
    return jsonify({
        'questions': [q.to_dict(include_answer=True) for q in questions]
    }), 200


@bp.route('/<int:question_id>', methods=['GET'])
@jwt_required()
def get_question(question_id):
    """Get question details with answer."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    question = Question.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'question': question.to_dict(include_answer=True)
    }), 200


@bp.route('/<int:question_id>', methods=['PUT'])
@jwt_required()
def update_question(question_id):
    """Update question text or metadata."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    question = Question.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'text' in data:
        question.text = data['text']
    if 'section' in data:
        question.section = data['section']
    if 'order' in data:
        question.order = data['order']
    if 'status' in data:
        question.status = data['status']
    if 'notes' in data:
        question.notes = data['notes']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Question updated',
        'question': question.to_dict(include_answer=True)
    }), 200


@bp.route('/merge', methods=['POST'])
@jwt_required()
def merge_questions():
    """Merge multiple questions into one."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    question_ids = data.get('question_ids', [])
    
    if len(question_ids) < 2:
        return jsonify({'error': 'At least 2 questions required'}), 400
    
    questions = Question.query.filter(Question.id.in_(question_ids)).all()
    
    if len(questions) != len(question_ids):
        return jsonify({'error': 'Some questions not found'}), 404
    
    # Verify all from same project and org
    project_ids = set(q.project_id for q in questions)
    if len(project_ids) > 1:
        return jsonify({'error': 'Questions must be from same project'}), 400
    
    first_q = questions[0]
    if first_q.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Merge text
    merged_text = '\n\n'.join(q.text for q in questions)
    first_q.text = merged_text
    first_q.original_text = merged_text
    
    # Delete other questions
    for q in questions[1:]:
        db.session.delete(q)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Questions merged',
        'question': first_q.to_dict()
    }), 200


@bp.route('/split', methods=['POST'])
@jwt_required()
def split_question():
    """Split a question into multiple."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    question_id = data.get('question_id')
    split_texts = data.get('texts', [])
    
    if not question_id or len(split_texts) < 2:
        return jsonify({'error': 'Question ID and at least 2 texts required'}), 400
    
    question = Question.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Update original question
    question.text = split_texts[0]
    
    # Create new questions
    new_questions = []
    base_order = question.order
    for i, text in enumerate(split_texts[1:], start=1):
        new_q = Question(
            text=text,
            section=question.section,
            order=base_order + i,
            project_id=question.project_id,
            document_id=question.document_id
        )
        db.session.add(new_q)
        new_questions.append(new_q)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Question split',
        'questions': [question.to_dict()] + [q.to_dict() for q in new_questions]
    }), 201


@bp.route('/<int:question_id>', methods=['DELETE'])
@jwt_required()
def delete_question(question_id):
    """Delete a question."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    question = Question.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(question)
    db.session.commit()
    
    return jsonify({'message': 'Question deleted'}), 200
