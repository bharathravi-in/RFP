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


@bp.route('', methods=['POST'])
@jwt_required()
def create_question():
    """Create a new question manually."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    project_id = data.get('project_id')
    text = data.get('text')
    section = data.get('section', '')
    
    if not project_id or not text:
        return jsonify({'error': 'Project ID and question text required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get the next order number
    max_order = db.session.query(db.func.max(Question.order)).filter_by(
        project_id=project_id
    ).scalar() or 0
    
    question = Question(
        text=text,
        original_text=text,
        section=section,
        order=max_order + 1,
        status='pending',
        project_id=project_id
    )
    
    db.session.add(question)
    db.session.commit()
    
    return jsonify({
        'message': 'Question created',
        'question': question.to_dict(include_answer=True)
    }), 201


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

@bp.route('/<int:question_id>/generate-answer', methods=['POST'])
@jwt_required()
def generate_answer(question_id):
    """Generate an AI answer for a question and save it."""
    import logging
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    question = Question.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        from app.agents import get_answer_generator_agent
        from app.models import Answer
        
        # Initialize agent with org_id
        agent = get_answer_generator_agent()
        
        # Generate answer using AI - use generate_answers method
        result = agent.generate_answers(
            questions=[{
                'id': question.id,
                'text': question.text,
                'category': question.category or 'general'
            }]
        )
        
        logging.info(f"Answer generation result: {result}")
        
        # Check if successful
        if not result.get('success', False):
            return jsonify({'error': result.get('error', 'Generation failed')}), 500
        
        # Get generated answer
        answers = result.get('answers', [])
        if answers and len(answers) > 0:
            answer_data = answers[0]
            answer_content = answer_data.get('answer', '')  # The 'answer' field contains the content
            confidence = answer_data.get('confidence_score', 0.7)
            
            logging.info(f"Generated answer: {answer_content[:100]}...")
            
            # Create or update answer - use current_answer property (answers is plural)
            existing_answer = question.current_answer
            if existing_answer:
                existing_answer.content = answer_content
                existing_answer.confidence_score = confidence
            else:
                answer = Answer(
                    content=answer_content,
                    confidence_score=confidence,
                    question_id=question.id
                )
                db.session.add(answer)
            
            # Update question status
            question.status = 'answered'
            db.session.commit()
            
            return jsonify({
                'message': 'Answer generated',
                'question': question.to_dict(include_answer=True)
            }), 200
        else:
            return jsonify({'error': 'No answer generated'}), 500
            
    except Exception as e:
        logging.error(f"Answer generation failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
