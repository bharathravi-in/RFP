"""
Smart Search routes for AI-powered unified search.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Project, AnswerLibraryItem, KnowledgeItem

bp = Blueprint('smart_search', __name__)


@bp.route('/smart', methods=['POST'])
@jwt_required()
def smart_search():
    """
    AI-powered unified search across projects, answers, and knowledge base.
    Supports natural language queries like "security compliance for government".
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.organization_id:
        return jsonify({'results': []}), 200
    
    data = request.get_json()
    query = data.get('query', '').strip()
    
    if not query or len(query) < 2:
        return jsonify({'error': 'Query must be at least 2 characters'}), 400
    
    # Optional filters
    categories = data.get('categories', [])  # ['projects', 'answers', 'knowledge']
    limit = data.get('limit', 20)
    
    results = []
    
    # If no categories specified, search all
    search_all = not categories
    
    # Search Projects
    if search_all or 'projects' in categories:
        projects = _search_projects(user.organization_id, query, limit=5)
        results.extend(projects)
    
    # Search Answer Library with semantic similarity via Qdrant
    if search_all or 'answers' in categories:
        answers = _search_answers(user.organization_id, query, limit=8)
        results.extend(answers)
    
    # Search Knowledge Base with semantic similarity via Qdrant
    if search_all or 'knowledge' in categories:
        knowledge = _search_knowledge(user.organization_id, query, limit=7)
        results.extend(knowledge)
    
    # Sort by relevance score (descending)
    results.sort(key=lambda x: x.get('score', 0), reverse=True)
    
    return jsonify({
        'query': query,
        'results': results[:limit],
        'total': len(results)
    })


def _search_projects(org_id: int, query: str, limit: int = 5):
    """Search projects by name, description, and client name."""
    query_lower = query.lower()
    
    projects = Project.query.filter(
        Project.organization_id == org_id,
        db.or_(
            Project.name.ilike(f'%{query_lower}%'),
            Project.description.ilike(f'%{query_lower}%'),
            Project.client_name.ilike(f'%{query_lower}%'),
        )
    ).limit(limit).all()
    
    return [{
        'type': 'project',
        'id': p.id,
        'title': p.name,
        'description': p.description or f'Client: {p.client_name or "N/A"}',
        'status': p.status,
        'score': _calculate_text_score(query_lower, [p.name, p.description or '', p.client_name or '']),
        'url': f'/projects/{p.id}',
        'metadata': {
            'status': p.status,
            'completion': p.completion_percent,
            'client': p.client_name,
        }
    } for p in projects]


def _search_answers(org_id: int, query: str, limit: int = 8):
    """Search answer library using text and semantic similarity."""
    results = []
    
    # Try semantic search via Qdrant first
    try:
        from ..services.qdrant_service import get_qdrant_service
        qdrant = get_qdrant_service(org_id=org_id)
        
        if qdrant.enabled:
            semantic_results = qdrant.search(
                query=query,
                org_id=org_id,
                limit=limit,
                score_threshold=0.3
            )
            
            # Get answer library items matching IDs
            if semantic_results:
                item_ids = [r.get('item_id') for r in semantic_results if r.get('item_id')]
                items = AnswerLibraryItem.query.filter(
                    AnswerLibraryItem.id.in_(item_ids),
                    AnswerLibraryItem.is_active == True
                ).all()
                items_map = {i.id: i for i in items}
                
                for sr in semantic_results:
                    item_id = sr.get('item_id')
                    if item_id in items_map:
                        item = items_map[item_id]
                        results.append({
                            'type': 'answer',
                            'id': item.id,
                            'title': item.question_text[:100] + ('...' if len(item.question_text) > 100 else ''),
                            'description': item.answer_text[:200] + ('...' if len(item.answer_text) > 200 else ''),
                            'score': sr.get('score', 0.5),
                            'url': f'/answer-library?highlight={item.id}',
                            'metadata': {
                                'category': item.category,
                                'tags': item.tags or [],
                                'times_used': item.times_used,
                            }
                        })
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Qdrant search failed, falling back to text: {e}")
    
    # Fallback to text search if semantic search didn't return enough
    if len(results) < limit:
        query_lower = query.lower()
        text_items = AnswerLibraryItem.query.filter(
            AnswerLibraryItem.organization_id == org_id,
            AnswerLibraryItem.is_active == True,
            db.or_(
                AnswerLibraryItem.question_text.ilike(f'%{query_lower}%'),
                AnswerLibraryItem.answer_text.ilike(f'%{query_lower}%'),
            )
        ).limit(limit - len(results)).all()
        
        existing_ids = {r['id'] for r in results}
        for item in text_items:
            if item.id not in existing_ids:
                results.append({
                    'type': 'answer',
                    'id': item.id,
                    'title': item.question_text[:100] + ('...' if len(item.question_text) > 100 else ''),
                    'description': item.answer_text[:200] + ('...' if len(item.answer_text) > 200 else ''),
                    'score': _calculate_text_score(query_lower, [item.question_text, item.answer_text]),
                    'url': f'/answer-library?highlight={item.id}',
                    'metadata': {
                        'category': item.category,
                        'tags': item.tags or [],
                        'times_used': item.times_used,
                    }
                })
    
    return results[:limit]


def _search_knowledge(org_id: int, query: str, limit: int = 7):
    """Search knowledge base using text and semantic similarity."""
    results = []
    
    # Try semantic search via Qdrant first
    try:
        from ..services.qdrant_service import get_qdrant_service
        qdrant = get_qdrant_service(org_id=org_id)
        
        if qdrant.enabled:
            semantic_results = qdrant.search(
                query=query,
                org_id=org_id,
                limit=limit,
                score_threshold=0.3
            )
            
            for sr in semantic_results:
                results.append({
                    'type': 'knowledge',
                    'id': sr.get('item_id'),
                    'title': sr.get('title', 'Knowledge Item'),
                    'description': sr.get('content_preview', '')[:200],
                    'score': sr.get('score', 0.5),
                    'url': '/knowledge',
                    'metadata': {
                        'folder_id': sr.get('folder_id'),
                        'tags': sr.get('tags', []),
                    }
                })
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Qdrant search failed, falling back to text: {e}")
    
    # Fallback to text search
    if len(results) < limit:
        query_lower = query.lower()
        text_items = KnowledgeItem.query.filter(
            KnowledgeItem.organization_id == org_id,
            KnowledgeItem.is_active == True,
            db.or_(
                KnowledgeItem.title.ilike(f'%{query_lower}%'),
                KnowledgeItem.content.ilike(f'%{query_lower}%'),
            )
        ).limit(limit - len(results)).all()
        
        existing_ids = {r['id'] for r in results}
        for item in text_items:
            if item.id not in existing_ids:
                results.append({
                    'type': 'knowledge',
                    'id': item.id,
                    'title': item.title,
                    'description': (item.content or '')[:200] + ('...' if len(item.content or '') > 200 else ''),
                    'score': _calculate_text_score(query_lower, [item.title, item.content or '']),
                    'url': '/knowledge',
                    'metadata': {
                        'folder_id': item.folder_id,
                        'tags': item.tags or [],
                    }
                })
    
    return results[:limit]


def _calculate_text_score(query: str, texts: list) -> float:
    """Calculate a simple relevance score based on text matching."""
    query_lower = query.lower()
    words = query_lower.split()
    
    total_score = 0.0
    for text in texts:
        if not text:
            continue
        text_lower = text.lower()
        
        # Exact phrase match
        if query_lower in text_lower:
            total_score += 0.5
        
        # Word matches
        word_matches = sum(1 for word in words if word in text_lower)
        total_score += (word_matches / len(words)) * 0.3 if words else 0
        
        # Title boost (first text is usually title)
        if text == texts[0] and query_lower in text_lower:
            total_score += 0.2
    
    return min(1.0, total_score)
