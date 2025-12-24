from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Answer, AnswerComment, Question, User, KnowledgeItem, AuditLog

bp = Blueprint('answers', __name__)


@bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_answer():
    """Generate AI answer for a question with enhanced RAG support."""
    user_id = int(get_jwt_identity())
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
    
    # Import services
    from ..services.ai_service import ai_service
    from ..services.classification_service import classification_service
    from ..services.answer_reuse_service import answer_reuse_service
    
    # Step 1: Classify question if not already classified
    if not question.category:
        classification = classification_service.classify_question(question.text)
        question.category = classification.get('category')
        question.sub_category = classification.get('sub_category')
        if classification.get('flags'):
            question.flags = (question.flags or []) + classification.get('flags', [])
    
    # Step 2: Get knowledge base context
    knowledge_context = []
    try:
        from ..services.qdrant_service import get_qdrant_service
        qdrant = get_qdrant_service()
        if qdrant.enabled:
            search_results = qdrant.search(
                query=question.text,
                org_id=user.organization_id,
                limit=5
            )
            if search_results:
                item_ids = [r['item_id'] for r in search_results]
                items = KnowledgeItem.query.filter(
                    KnowledgeItem.id.in_(item_ids)
                ).all()
                items_map = {item.id: item for item in items}
                
                for r in search_results:
                    if r['item_id'] in items_map:
                        item = items_map[r['item_id']]
                        knowledge_context.append({
                            'title': item.title,
                            'content': item.content[:1000],
                            'relevance': r['score'],
                            'item_id': item.id,
                            'category': item.category
                        })
                        # Update usage tracking
                        item.usage_count = (item.usage_count or 0) + 1
                        item.last_used_at = datetime.utcnow()
    except Exception as e:
        import logging
        logging.error(f"Knowledge search failed: {e}")
    
    # Step 3: Find similar approved answers
    similar_answers = answer_reuse_service.find_similar_answers(
        question.text,
        user.organization_id,
        question.category,
        limit=2
    )
    
    # Step 4: Generate the answer using enhanced AI service
    result = ai_service.generate_answer(
        question=question.text,
        context=knowledge_context,
        tone=tone,
        length=length,
        similar_answers=similar_answers,
        question_category=question.category,
        sub_category=question.sub_category
    )
    
    # Step 5: Create the answer record
    current_version = Answer.query.filter_by(question_id=question_id).count()
    
    answer = Answer(
        content=result['content'],
        confidence_score=result['confidence_score'],
        sources=result['sources'],
        status='draft',
        version=current_version + 1,
        is_ai_generated=True,
        generation_params=result.get('generation_params', {}),
        question_id=question_id
    )
    
    db.session.add(answer)
    
    # Update question status and flags
    question.status = 'answered'
    if result.get('flags'):
        question.flags = list(set((question.flags or []) + result['flags']))
    
    # Step 6: Create audit log entry
    AuditLog.log(
        action='generate',
        resource_type='answer',
        resource_id=answer.id,
        user_id=user_id,
        organization_id=user.organization_id,
        new_value={'question_id': question_id, 'confidence': result['confidence_score']},
        details={
            'context_count': len(knowledge_context),
            'similar_answers_count': len(similar_answers),
            'category': question.category
        }
    )
    
    db.session.commit()
    
    return jsonify({
        'message': 'Answer generated',
        'answer': answer.to_dict(),
        'classification': {
            'category': question.category,
            'sub_category': question.sub_category
        },
        'knowledge_context_count': len(knowledge_context),
        'similar_answers_count': len(similar_answers),
        'flags': result.get('flags', [])
    }), 201


@bp.route('/regenerate', methods=['POST'])
@jwt_required()
def regenerate_answer():
    """Regenerate answer with feedback or action."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    question_id = data.get('question_id')
    answer_id = data.get('answer_id')
    feedback = data.get('feedback', '')
    action = data.get('action', 'regenerate')  # regenerate, shorten, expand, improve_tone
    
    # Support both question_id and answer_id for flexibility
    if question_id:
        question = Question.query.get(question_id)
        if not question:
            return jsonify({'error': 'Question not found'}), 404
        if question.project.organization_id != user.organization_id:
            return jsonify({'error': 'Access denied'}), 403
        # Get the latest answer for this question
        answer = Answer.query.filter_by(question_id=question_id).order_by(Answer.version.desc()).first()
    elif answer_id:
        answer = Answer.query.get(answer_id)
        if not answer:
            return jsonify({'error': 'Answer not found'}), 404
        if answer.question.project.organization_id != user.organization_id:
            return jsonify({'error': 'Access denied'}), 403
        question = answer.question
    else:
        return jsonify({'error': 'Question ID or Answer ID required'}), 400
    
    from ..services.ai_service import ai_service
    
    if answer and action in ['shorten', 'expand', 'improve_tone', 'make_formal', 'make_friendly']:
        # Modify existing answer
        new_content = ai_service.modify_answer(
            original=answer.content,
            action=action,
            context=feedback
        )
    else:
        # Full regeneration with feedback context
        # Get knowledge context
        knowledge_context = []
        try:
            from ..services.qdrant_service import get_qdrant_service
            qdrant = get_qdrant_service()
            if qdrant.enabled:
                search_query = question.text
                if feedback:
                    search_query = f"{question.text} {feedback}"
                search_results = qdrant.search(
                    query=search_query,
                    org_id=user.organization_id,
                    limit=5
                )
                if search_results:
                    item_ids = [r['item_id'] for r in search_results]
                    items = KnowledgeItem.query.filter(
                        KnowledgeItem.id.in_(item_ids)
                    ).all()
                    items_map = {item.id: item for item in items}
                    
                    for r in search_results:
                        if r['item_id'] in items_map:
                            item = items_map[r['item_id']]
                            knowledge_context.append({
                                'title': item.title,
                                'content': item.content[:1000],
                                'relevance': r['score'],
                                'item_id': item.id
                            })
        except Exception as e:
            import logging
            logging.error(f"Knowledge search failed: {e}")
        
        # Generate new answer with feedback incorporated
        result = ai_service.generate_answer(
            question=f"{question.text}\n\nUser feedback for regeneration: {feedback}" if feedback else question.text,
            context=knowledge_context,
            tone='professional',
            length='medium',
            question_category=question.category,
            sub_category=question.sub_category
        )
        new_content = result['content']
    
    # Create new version
    current_version = Answer.query.filter_by(question_id=question.id).count()
    
    new_answer = Answer(
        content=new_content,
        confidence_score=result.get('confidence_score', 0.5) if 'result' in dir() else (answer.confidence_score if answer else 0.5),
        sources=result.get('sources', []) if 'result' in dir() else (answer.sources if answer else []),
        status='draft',
        version=current_version + 1,
        is_ai_generated=True,
        generation_params={'action': action, 'feedback': feedback, 'based_on': answer.id if answer else None},
        question_id=question.id
    )
    
    db.session.add(new_answer)
    question.status = 'answered'
    db.session.commit()
    
    return jsonify({
        'message': f'Answer {action}d',
        'answer': new_answer.to_dict(),
        'question': question.to_dict(include_answer=True)
    }), 201


@bp.route('', methods=['POST'])
@jwt_required()
def create_answer():
    """Create an answer with provided content (e.g., from library)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    question_id = data.get('question_id')
    content = data.get('content')
    
    if not question_id:
        return jsonify({'error': 'Question ID required'}), 400
    if not content:
        return jsonify({'error': 'Content required'}), 400
    
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    if question.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Check if answer already exists
    existing_answer = Answer.query.filter_by(question_id=question_id).first()
    if existing_answer:
        # Update existing answer instead
        existing_answer.content = content
        existing_answer.is_ai_generated = False
        db.session.commit()
        question.status = 'answered'
        db.session.commit()
        return jsonify({
            'message': 'Answer updated',
            'answer': existing_answer.to_dict(),
            'status': question.status
        }), 200
    
    # Create new answer
    answer = Answer(
        content=content,
        confidence_score=0.8,  # Manual/library answer
        sources=[],
        status='draft',
        version=1,
        is_ai_generated=False,
        generation_params={'source': 'library'},
        question_id=question_id
    )
    
    db.session.add(answer)
    question.status = 'answered'
    db.session.commit()
    
    return jsonify({
        'message': 'Answer created',
        'answer': answer.to_dict(),
        'status': question.status
    }), 201


@bp.route('/<int:answer_id>', methods=['PUT'])
@jwt_required()
def update_answer(answer_id):
    """Edit answer content."""
    user_id = int(get_jwt_identity())
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
    """Approve or reject an answer with continuous learning."""
    user_id = int(get_jwt_identity())
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
    
    old_status = answer.status
    answer.status = 'approved' if action == 'approve' else 'rejected'
    answer.review_notes = notes
    answer.reviewed_by = user_id
    answer.reviewed_at = datetime.utcnow()
    
    # Update question status
    if action == 'approve':
        answer.question.status = 'approved'
        
        # Store approved answer for future reuse (continuous learning)
        try:
            from ..services.answer_reuse_service import answer_reuse_service
            answer_reuse_service.store_approved_answer(answer.id)
        except Exception as e:
            import logging
            logging.error(f"Failed to store approved answer for reuse: {e}")
    elif action == 'reject':
        answer.question.status = 'answered'  # Back to editing
    
    # Create audit log entry
    AuditLog.log(
        action=action,
        resource_type='answer',
        resource_id=answer_id,
        user_id=user_id,
        organization_id=user.organization_id,
        old_value={'status': old_status},
        new_value={'status': answer.status, 'notes': notes},
        details={
            'question_id': answer.question_id,
            'question_text': answer.question.text[:100]
        }
    )
    
    db.session.commit()
    
    return jsonify({
        'message': f'Answer {action}d',
        'answer': answer.to_dict(),
        'stored_for_reuse': action == 'approve'
    }), 200



@bp.route('/<int:answer_id>/comment', methods=['POST'])
@jwt_required()
def add_comment(answer_id):
    """Add inline comment to answer."""
    user_id = int(get_jwt_identity())
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
    user_id = int(get_jwt_identity())
    
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


@bp.route('/similar', methods=['POST'])
@jwt_required()
def find_similar_answers():
    """Find similar approved answers for a question."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    question_text = data.get('question_text')
    category = data.get('category')
    limit = data.get('limit', 5)
    
    if not question_text:
        return jsonify({'error': 'Question text required'}), 400
    
    from ..services.answer_reuse_service import answer_reuse_service
    
    similar = answer_reuse_service.find_similar_answers(
        question_text=question_text,
        org_id=user.organization_id,
        category=category,
        limit=limit
    )
    
    return jsonify({
        'similar_answers': similar,
        'count': len(similar)
    }), 200


@bp.route('/suggest-template', methods=['POST'])
@jwt_required()
def suggest_template():
    """Get template suggestion based on similar approved answers."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    question_text = data.get('question_text')
    category = data.get('category')
    
    if not question_text:
        return jsonify({'error': 'Question text required'}), 400
    
    from ..services.answer_reuse_service import answer_reuse_service
    
    suggestion = answer_reuse_service.suggest_template(
        question_text=question_text,
        org_id=user.organization_id,
        category=category
    )
    
    if suggestion:
        return jsonify({
            'has_suggestion': True,
            'suggestion': suggestion
        }), 200
    else:
        return jsonify({
            'has_suggestion': False,
            'message': 'No similar approved answers found'
        }), 200


@bp.route('/classify', methods=['POST'])
@jwt_required()
def classify_question():
    """Classify a question into categories."""
    data = request.get_json()
    question_text = data.get('question_text')
    
    if not question_text:
        return jsonify({'error': 'Question text required'}), 400
    
    from ..services.classification_service import classification_service
    
    result = classification_service.classify_question(question_text)
    
    return jsonify({
        'classification': result
    }), 200


@bp.route('/classify-batch', methods=['POST'])
@jwt_required()
def classify_batch():
    """Classify multiple questions at once."""
    data = request.get_json()
    questions = data.get('questions', [])
    
    if not questions:
        return jsonify({'error': 'Questions list required'}), 400
    
    if len(questions) > 100:
        return jsonify({'error': 'Maximum 100 questions per batch'}), 400
    
    from ..services.classification_service import classification_service
    
    results = classification_service.classify_batch(questions)
    
    return jsonify({
        'classifications': results,
        'count': len(results)
    }), 200


@bp.route('/reuse-stats', methods=['GET'])
@jwt_required()
def get_reuse_stats():
    """Get statistics about answer reuse."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    from ..services.answer_reuse_service import answer_reuse_service
    
    most_reused = answer_reuse_service.get_most_reused_answers(
        org_id=user.organization_id,
        limit=10
    )
    
    return jsonify({
        'most_reused_answers': most_reused
    }), 200
