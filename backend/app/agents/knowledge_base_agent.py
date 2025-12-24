"""
Knowledge Base Agent

Searches and retrieves relevant context from the knowledge base
for answering RFP questions.
"""
import logging
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class KnowledgeBaseAgent:
    """
    Agent that retrieves relevant knowledge for answering questions.
    - Searches Qdrant vector database
    - Finds similar approved answers
    - Retrieves company information
    """
    
    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='default')
        self.name = "KnowledgeBaseAgent"
        self._qdrant = None
        self._answer_reuse = None
    
    @property
    def qdrant_service(self):
        """Lazy load Qdrant service."""
        if self._qdrant is None:
            try:
                from app.services.qdrant_service import get_qdrant_service
                self._qdrant = get_qdrant_service()
            except Exception as e:
                logger.warning(f"Could not load Qdrant service: {e}")
        return self._qdrant
    
    @property
    def answer_reuse_service(self):
        """Lazy load answer reuse service."""
        if self._answer_reuse is None:
            try:
                from app.services.answer_reuse_service import answer_reuse_service
                self._answer_reuse = answer_reuse_service
            except Exception as e:
                logger.warning(f"Could not load answer reuse service: {e}")
        return self._answer_reuse
    
    def _expand_query(self, query: str, category: str = None) -> List[str]:
        """
        Expand query with search variations for better recall.
        Uses LLM to generate semantically similar search terms.
        
        Args:
            query: Original search query
            category: Question category for context
            
        Returns:
            List of query variations including original
        """
        expanded = [query]
        
        # Try to use LLM for intelligent expansion
        if self.config.client:
            try:
                expansion_prompt = f"""Generate 2 alternative search queries for finding relevant knowledge to answer this question.
                
Question: {query}
{f'Category: {category}' if category else ''}

Return only 2 alternative queries, one per line. Keep them concise and focused on key concepts."""
                
                if self.config.is_adk_enabled:
                    response = self.config.client.models.generate_content(
                        model=self.config.model_name,
                        contents=expansion_prompt
                    )
                    variations = response.text.strip().split('\n')[:2]
                else:
                    response = self.config.client.generate_content(expansion_prompt)
                    variations = response.text.strip().split('\n')[:2]
                
                # Clean and add variations
                for v in variations:
                    v = v.strip().lstrip('0123456789.-) ')
                    if v and len(v) > 10 and v not in expanded:
                        expanded.append(v)
                        
                logger.debug(f"Expanded query '{query[:50]}...' to {len(expanded)} variations")
                
            except Exception as e:
                logger.warning(f"Query expansion failed: {e}")
        
        return expanded
    
    def _merge_search_results(self, all_results: List[List[Dict]], limit: int = 5) -> List[Dict]:
        """
        Merge and deduplicate results from multiple searches.
        Uses max score when same item appears multiple times.
        
        Args:
            all_results: List of result lists from different searches
            limit: Maximum results to return
            
        Returns:
            Merged and ranked results
        """
        seen_ids = {}
        
        for results in all_results:
            for result in results:
                item_id = result.get("item_id")
                if item_id:
                    if item_id not in seen_ids:
                        seen_ids[item_id] = result
                    else:
                        # Keep higher score
                        if result.get("score", 0) > seen_ids[item_id].get("score", 0):
                            seen_ids[item_id] = result
                else:
                    # No item_id, use content hash
                    content = result.get("content_preview", "")[:100]
                    if content not in seen_ids:
                        seen_ids[content] = result
        
        # Sort by score and return top results
        merged = sorted(seen_ids.values(), key=lambda x: x.get("score", 0), reverse=True)
        return merged[:limit]
    
    def _rerank_results(self, results: List[Dict], query: str, limit: int = 5) -> List[Dict]:
        """
        Use LLM to re-rank results by relevance to query.
        
        Args:
            results: Initial search results
            query: Original search query
            limit: Maximum results to return
            
        Returns:
            Re-ranked results with updated scores
        """
        if not results or len(results) <= 1:
            return results
        
        # Only re-rank if we have a client
        if not self.config.client:
            return results[:limit]
        
        # Format results for LLM
        results_text = "\n".join([
            f"[{i+1}] {r.get('title', 'Untitled')}: {r.get('content_preview', '')[:200]}"
            for i, r in enumerate(results[:10])  # Max 10 for re-ranking
        ])
        
        rerank_prompt = f"""Given this search query and the search results, rank the results from most to least relevant.

Query: {query}

Results:
{results_text}

Return a JSON array of result numbers in order of relevance, e.g. [3, 1, 5, 2, 4].
Only return the JSON array, nothing else."""

        try:
            if self.config.is_adk_enabled:
                response = self.config.client.models.generate_content(
                    model=self.config.model_name,
                    contents=rerank_prompt
                )
                response_text = response.text.strip()
            else:
                response = self.config.client.generate_content(rerank_prompt)
                response_text = response.text.strip()
            
            # Parse ranking
            import json
            import re
            response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
            response_text = re.sub(r'\n?```$', '', response_text)
            ranking = json.loads(response_text)
            
            # Reorder results based on ranking
            reranked = []
            for idx in ranking[:limit]:
                if 1 <= idx <= len(results):
                    result = results[idx - 1].copy()
                    result["reranked_position"] = len(reranked) + 1
                    result["original_position"] = idx
                    reranked.append(result)
            
            # Add any results that weren't in the ranking
            for i, r in enumerate(results):
                if (i + 1) not in ranking and len(reranked) < limit:
                    reranked.append(r)
            
            logger.debug(f"Re-ranked {len(results)} results for query: {query[:50]}")
            return reranked
            
        except Exception as e:
            logger.warning(f"Re-ranking failed: {e}")
            return results[:limit]


    
    def retrieve_context(
        self,
        questions: List[Dict] = None,
        org_id: int = None,
        project_id: int = None,  # NEW: Auto-fetch project dimensions
        session_state: Dict = None,
        # Project dimension filters (optional - will be auto-fetched from project if not provided)
        geography: str = None,
        client_type: str = None,
        industry: str = None,
        knowledge_profile_ids: List[int] = None
    ) -> Dict:
        """
        Retrieve knowledge context for the given questions.
        
        Args:
            questions: List of questions to find context for
            org_id: Organization ID for scoping knowledge search
            project_id: Project ID to auto-fetch dimensions (NEW)
            session_state: Shared state with extracted questions
            geography: Filter by geography (US, EU, APAC, etc.) - auto-fetched if not provided
            client_type: Filter by client type (government, private, etc.) - auto-fetched if not provided
            industry: Filter by industry (healthcare, finance, etc.) - auto-fetched if not provided
            knowledge_profile_ids: List of profile IDs to search within - auto-fetched if not provided
            
        Returns:
            Context mapping for each question with applied filters
        """
        session_state = session_state or {}
        
        # Get questions from session if not provided
        questions = questions or session_state.get(SessionKeys.EXTRACTED_QUESTIONS, [])
        if not questions:
            return {"success": False, "error": "No questions to process"}
        
        # Auto-fetch project dimensions if project_id provided
        if project_id and not all([geography, client_type, industry, knowledge_profile_ids]):
            try:
                from app.models import Project
                project = Project.query.get(project_id)
                if project:
                    geography = geography or project.geography
                    client_type = client_type or project.client_type
                    industry = industry or project.industry
                    # Get knowledge profile IDs from project's profiles
                    if not knowledge_profile_ids and project.knowledge_profiles:
                        knowledge_profile_ids = [p.id for p in project.knowledge_profiles]
                    logger.info(f"Auto-fetched project dimensions: geography={geography}, client_type={client_type}, industry={industry}")
            except Exception as e:
                logger.warning(f"Could not auto-fetch project dimensions: {e}")
        
        # Build dimension filter for Qdrant
        dimension_filter = {}
        if geography:
            dimension_filter['geography'] = geography
        if client_type:
            dimension_filter['client_type'] = client_type
        if industry:
            dimension_filter['industry'] = industry
        if knowledge_profile_ids:
            dimension_filter['knowledge_profile_ids'] = knowledge_profile_ids
        
        knowledge_context = {}
        
        for question in questions:
            q_id = question.get("id", 0)
            q_text = question.get("text", "")
            q_category = question.get("category", "general")
            
            context = {
                "knowledge_items": [],
                "similar_answers": [],
                "relevance_score": 0.0,
                "filters_applied": dimension_filter
            }
            
            # Search Qdrant for relevant knowledge with dimension filtering
            # Use query expansion for better recall
            if self.qdrant_service and org_id:
                try:
                    # Expand query for better coverage
                    query_variations = self._expand_query(q_text, q_category)
                    
                    # Search with all variations
                    all_results = []
                    for query in query_variations:
                        results = self.qdrant_service.search(
                            query=query,
                            org_id=org_id,
                            limit=3,  # Fewer per query since we're doing multiple
                            filters=dimension_filter if dimension_filter else None
                        )
                        all_results.append(results)
                    
                    # Merge and deduplicate results
                    search_results = self._merge_search_results(all_results, limit=5)
                    
                    context["knowledge_items"] = [
                        {
                            "title": r.get("title", "Knowledge"),
                            "content": r.get("content_preview", "")[:500],
                            "relevance": r.get("score", 0),
                            "item_id": r.get("item_id"),
                            "geography": r.get("geography"),
                            "client_type": r.get("client_type"),
                            "industry": r.get("industry")
                        }
                        for r in search_results
                    ]
                    if context["knowledge_items"]:
                        context["relevance_score"] = max(
                            item["relevance"] for item in context["knowledge_items"]
                        )
                except Exception as e:
                    logger.error(f"Qdrant search failed for question {q_id}: {e}")
            
            # Find similar approved answers
            if self.answer_reuse_service and org_id:
                try:
                    similar = self.answer_reuse_service.find_similar_answers(
                        question_text=q_text,
                        org_id=org_id,
                        category=q_category,
                        limit=2
                    )
                    context["similar_answers"] = [
                        {
                            "question_text": s.get("question_text", "")[:200],
                            "answer_content": s.get("answer_content", "")[:500],
                            "similarity_score": s.get("similarity_score", 0),
                            "answer_id": s.get("answer_id")
                        }
                        for s in similar
                    ]
                except Exception as e:
                    logger.error(f"Similar answer search failed: {e}")
            
            knowledge_context[q_id] = context
        
        # Store in session state
        session_state[SessionKeys.KNOWLEDGE_CONTEXT] = knowledge_context
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        total_items = sum(
            len(ctx.get("knowledge_items", [])) 
            for ctx in knowledge_context.values()
        )
        filter_summary = ", ".join(f"{k}={v}" for k, v in dimension_filter.items()) if dimension_filter else "no filters"
        messages.append({
            "agent": self.name,
            "action": "context_retrieved",
            "summary": f"Retrieved {total_items} knowledge items for {len(questions)} questions ({filter_summary})"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "knowledge_context": knowledge_context,
            "questions_processed": len(questions),
            "dimension_filters": dimension_filter,
            "session_state": session_state
        }
    
    def search_knowledge(
        self,
        query: str,
        org_id: int,
        limit: int = 5
    ) -> List[Dict]:
        """
        Direct knowledge search for a single query.
        
        Args:
            query: Search query text
            org_id: Organization ID
            limit: Maximum results to return
            
        Returns:
            List of matching knowledge items
        """
        if not self.qdrant_service:
            return []
        
        try:
            return self.qdrant_service.search(
                query=query,
                org_id=org_id,
                limit=limit
            )
        except Exception as e:
            logger.error(f"Knowledge search failed: {e}")
            return []


def get_knowledge_base_agent() -> KnowledgeBaseAgent:
    """Factory function to get Knowledge Base Agent."""
    return KnowledgeBaseAgent()
