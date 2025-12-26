"""
Enhanced AI Service for Answer Generation

Provides AI-powered answer generation with:
- RAG (Retrieval Augmented Generation) integration
- Confidence scoring based on context quality
- Question-category-specific prompting
- Similar answer suggestions
- Flag detection for low-confidence responses
"""
import os
import logging
from typing import Optional, List, Dict
from datetime import datetime

logger = logging.getLogger(__name__)


class AIService:
    """Enhanced AI service for answer generation with RAG support."""
    
    # Confidence scoring factors
    CONFIDENCE_FACTORS = {
        'has_high_relevance_context': 0.20,   # Context with >0.8 score
        'multiple_sources': 0.15,              # 3+ knowledge sources
        'has_similar_approved': 0.25,          # Similar approved answer exists
        'category_specific_context': 0.10,     # Context matches question category
        'recent_knowledge': 0.10,              # Knowledge updated recently
    }
    
    # Category-specific prompting instructions
    CATEGORY_INSTRUCTIONS = {
        'security': """
For security questions:
- Be very precise about security claims and capabilities
- Only state what can be verified and is currently implemented
- Reference specific security certifications (SOC 2, ISO 27001, etc.)
- Include encryption standards and key lengths where relevant
- Never overstate security capabilities""",
        
        'compliance': """
For compliance questions:
- Reference specific compliance frameworks accurately
- Be clear about current certification status vs. in-progress certifications
- Include relevant audit dates if known
- Note any geographic or industry-specific compliance considerations
- Be precise about data handling and privacy practices""",
        
        'technical': """
For technical questions:
- Provide specific technical details where available
- Include version numbers, specifications, and standards
- Mention integration capabilities and API availability
- Reference architecture and infrastructure accurately
- Note any technical limitations or prerequisites""",
        
        'pricing': """
For pricing questions:
- Be clear about pricing structure and models
- Note any variables that affect pricing
- Avoid making commitments without proper authorization
- Suggest contacting sales for specific quotes if appropriate
- Mention any volume discounts or enterprise options""",
        
        'legal': """
For legal questions:
- Use cautious, precise language
- Avoid making binding legal commitments
- Note that legal agreements may be negotiable
- Suggest involving legal teams for complex matters
- Reference standard contract terms when applicable""",
        
        'product': """
For product questions:
- Focus on current capabilities
- Be clear about features that are roadmap items vs. available now
- Include relevant implementation details
- Mention support and training availability
- Reference documentation where applicable"""
    }
    
    def __init__(self, org_id: int = None):
        """Initialize AI service with optional organization ID for dynamic provider selection."""
        self.org_id = org_id
        self._provider = None
        # Fallback to env vars for backward compatibility
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.model_name = os.getenv('GOOGLE_MODEL', 'gemini-1.5-pro')
        self._client = None
    
    def _get_provider(self, org_id: int = None):
        """Get the LLM provider for the organization."""
        target_org = org_id or self.org_id
        if target_org:
            try:
                from app.services.llm_service_helper import get_llm_provider
                return get_llm_provider(target_org)
            except Exception as e:
                logger.warning(f"Failed to get dynamic provider: {e}, falling back to default")
        return None
    
    @property
    def client(self):
        """Lazy load the Google AI client (legacy fallback)."""
        if self._client is None and self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._client = genai.GenerativeModel(self.model_name)
            except Exception as e:
                logger.error(f"Failed to initialize AI client: {e}")
        return self._client
    
    def generate_answer(
        self,
        question: str,
        context: List[Dict] = None,
        tone: str = 'professional',
        length: str = 'medium',
        similar_answers: List[Dict] = None,
        question_category: str = None,
        sub_category: str = None,
        org_id: int = None
    ) -> Dict:
        """
        Generate an AI answer for a question with enhanced RAG support.
        
        Args:
            question: The RFP question to answer
            context: List of relevant knowledge base items with content and relevance scores
            tone: Desired tone (professional, formal, friendly)
            length: Desired length (short, medium, long)
            similar_answers: Previously approved answers for similar questions
            question_category: Category for specialized prompting
            sub_category: More specific category
        
        Returns:
            Dict with:
            - content: Generated answer text
            - confidence_score: 0.0 to 1.0 confidence rating
            - sources: List of source citations
            - flags: List of flags (low_confidence, needs_review, etc.)
            - generation_params: Parameters used for generation
        """
        context = context or []
        similar_answers = similar_answers or []
        
        # Calculate confidence based on available information
        confidence, flags = self._calculate_confidence(
            context, similar_answers, question_category
        )
        
        # Try dynamic provider first, then fall back to legacy client
        provider = self._get_provider(org_id)
        
        if not provider and not self.client:
            # Return placeholder for when API is not configured
            return self._placeholder_response(question, confidence, flags)
        
        # Build the enhanced prompt
        prompt = self._build_prompt(
            question=question,
            context=context,
            similar_answers=similar_answers,
            category=question_category,
            sub_category=sub_category,
            tone=tone,
            length=length
        )
        
        try:
            # Use dynamic provider if available, otherwise legacy client
            if provider:
                content = provider.generate_content(prompt)
                model_used = getattr(provider, 'model', 'dynamic')
            else:
                response = self.client.generate_content(prompt)
                content = response.text
                model_used = self.model_name
            
            # Post-process the response
            content = self._post_process_answer(content, tone)
            
            # Build source citations
            sources = self._build_sources(context, similar_answers)
            
            # Phase 4: Suggest a diagram if the question is technical
            suggested_diagram = None
            if question_category in ['technical', 'architecture', 'product']:
                suggested_diagram = self._suggest_diagram(question, context, org_id)

            return {
                'content': content,
                'confidence_score': confidence,
                'sources': sources,
                'flags': flags,
                'suggested_diagram': suggested_diagram,
                'generation_params': {
                    'tone': tone,
                    'length': length,
                    'category': question_category,
                    'context_count': len(context),
                    'similar_answer_count': len(similar_answers),
                    'model': model_used
                }
            }
            
        except Exception as e:
            logger.error(f"Answer generation failed: {e}")
            return {
                'content': f'Error generating answer: {str(e)}',
                'confidence_score': 0.0,
                'sources': [],
                'flags': ['generation_error'],
                'generation_params': {}
            }

    def _suggest_diagram(self, question: str, context: List[Dict], org_id: int = None) -> Optional[Dict]:
        """Suggest a diagram based on question and context."""
        try:
            from app.agents.diagram_generator_agent import get_diagram_generator_agent
            
            # Combine context for the agent
            context_text = "\n".join([c.get('content', '') for c in context[:3]])
            
            agent = get_diagram_generator_agent(org_id=org_id)
            result = agent.generate_for_context(question, context_text)
            
            if result.get('success'):
                return result.get('diagram')
        except Exception as e:
            logger.error(f"Diagram suggestion failed: {e}")
        return None
    
    def _build_prompt(
        self,
        question: str,
        context: List[Dict],
        similar_answers: List[Dict],
        category: str,
        sub_category: str,
        tone: str,
        length: str
    ) -> str:
        """Build an enhanced prompt for answer generation."""
        
        # Format context
        context_text = ""
        if context:
            context_parts = []
            for i, ctx in enumerate(context[:5], 1):  # Limit to 5 context items
                title = ctx.get('title', 'Knowledge Base')
                content = ctx.get('content', '')[:1000]  # Limit content length
                relevance = ctx.get('relevance', ctx.get('score', 0))
                context_parts.append(f"[Source {i}: {title} (Relevance: {relevance:.0%})]\n{content}")
            context_text = "\n\n---\n\n".join(context_parts)
        else:
            context_text = "No specific context found. Provide a general best-practice answer."
        
        # Format similar approved answers
        examples_text = ""
        if similar_answers:
            examples_parts = []
            for sa in similar_answers[:2]:  # Limit to 2 examples
                q = sa.get('question_text', '')[:200]
                a = sa.get('answer_content', '')[:500]
                similarity = sa.get('similarity_score', 0)
                examples_parts.append(f"Similar Question ({similarity:.0%} match): {q}\nApproved Answer: {a}")
            examples_text = f"\n\n## Previously Approved Similar Answers\n\n" + "\n\n---\n\n".join(examples_parts)
        
        # Get category-specific instructions
        category_instructions = self.CATEGORY_INSTRUCTIONS.get(category, "")
        
        # Length instructions
        length_instruction = {
            'short': 'Keep the answer concise, 2-3 sentences maximum.',
            'medium': 'Provide a balanced answer, 4-6 sentences with key details.',
            'long': 'Provide a detailed, comprehensive answer with examples and specifics.'
        }.get(length, 'Provide a balanced answer.')
        
        prompt = f"""You are an expert RFP response writer helping a company respond to a Request for Proposal.
Your goal is to provide accurate, professional, and compelling answers based on the provided context.

## Context from Knowledge Base

{context_text}
{examples_text}

## Question to Answer

{question}

## Instructions

1. **Tone**: Use a {tone} tone throughout your response.
2. **Length**: {length_instruction}
3. **Accuracy**: Only include information that can be supported by the provided context.
4. **Consistency**: Maintain consistency with any previously approved similar answers shown above.
5. **Specificity**: Be specific and avoid vague statements. Include concrete details when available.
{category_instructions}

## Response Requirements

- If the context provides direct information, use it to build your answer.
- If context is limited, provide a general best-practice answer but note any assumptions.
- Never make claims that cannot be verified.
- Format your response appropriately for the question type.

## Your Answer:"""
        
        return prompt
    
    def _calculate_confidence(
        self,
        context: List[Dict],
        similar_answers: List[Dict],
        category: str = None
    ) -> tuple:
        """
        Calculate confidence score based on available information.
        
        Returns:
            Tuple of (confidence_score, flags_list)
        """
        score = 0.40  # Base score
        flags = []
        
        if not context:
            flags.append('missing_context')
            score -= 0.15
        else:
            # Check context quality
            high_relevance = [c for c in context if c.get('relevance', c.get('score', 0)) > 0.8]
            if high_relevance:
                score += self.CONFIDENCE_FACTORS['has_high_relevance_context']
            
            if len(context) >= 3:
                score += self.CONFIDENCE_FACTORS['multiple_sources']
            
            # Check if context matches category
            if category:
                category_matches = [c for c in context if c.get('category') == category]
                if category_matches:
                    score += self.CONFIDENCE_FACTORS['category_specific_context']
        
        if similar_answers:
            best_similarity = max(sa.get('similarity_score', 0) for sa in similar_answers)
            if best_similarity > 0.85:
                score += self.CONFIDENCE_FACTORS['has_similar_approved']
        
        # Cap the score
        score = max(0.0, min(1.0, score))
        
        # Add flags based on final score
        if score < 0.5:
            flags.append('low_confidence')
            flags.append('needs_review')
        elif score < 0.7:
            flags.append('review_recommended')
        
        return round(score, 2), flags
    
    def _build_sources(
        self,
        context: List[Dict],
        similar_answers: List[Dict]
    ) -> List[Dict]:
        """Build source citations list."""
        sources = []
        
        for ctx in context[:5]:
            sources.append({
                'type': 'knowledge_base',
                'title': ctx.get('title', 'Knowledge Base'),
                'relevance': round(ctx.get('relevance', ctx.get('score', 0)), 2),
                'item_id': ctx.get('item_id')
            })
        
        for sa in similar_answers[:2]:
            sources.append({
                'type': 'approved_answer',
                'title': f"Similar: {sa.get('question_text', '')[:50]}...",
                'relevance': round(sa.get('similarity_score', 0), 2),
                'answer_id': sa.get('answer_id')
            })
        
        return sources
    
    def _post_process_answer(self, content: str, tone: str) -> str:
        """Clean up and format the generated answer."""
        # Remove any leading/trailing whitespace
        content = content.strip()
        
        # Remove any meta-commentary the AI might have added
        removes = [
            "Here is my answer:",
            "Based on the context provided:",
            "Answer:",
            "Response:",
        ]
        for remove in removes:
            if content.lower().startswith(remove.lower()):
                content = content[len(remove):].strip()
        
        return content
    
    def _placeholder_response(
        self,
        question: str,
        confidence: float,
        flags: List[str]
    ) -> Dict:
        """Generate a placeholder when AI service is not available."""
        flags.append('ai_service_unavailable')
        return {
            'content': f'[AI service not configured. Please set GOOGLE_API_KEY environment variable. Question: {question[:100]}...]',
            'confidence_score': 0.0,
            'sources': [],
            'flags': flags,
            'generation_params': {}
        }
    
    def modify_answer(
        self,
        original: str,
        action: str,
        context: str = None
    ) -> str:
        """
        Modify an existing answer.
        
        Args:
            original: The original answer text
            action: One of 'shorten', 'expand', 'improve_tone', 'make_formal', 'make_friendly'
            context: Optional additional context
        
        Returns:
            Modified answer text
        """
        if not self.client:
            return original
        
        prompts = {
            'shorten': f"Make this answer more concise while keeping all key information. Remove any redundancy:\n\n{original}",
            'expand': f"Expand this answer with more detail, examples, and specifics while maintaining accuracy:\n\n{original}",
            'improve_tone': f"Improve the professional tone and polish of this answer. Make it sound more confident and authoritative:\n\n{original}",
            'make_formal': f"Rewrite this answer in a more formal, enterprise-appropriate tone:\n\n{original}",
            'make_friendly': f"Rewrite this answer in a more approachable, friendly tone while remaining professional:\n\n{original}"
        }
        
        prompt = prompts.get(action, f"Improve this answer:\n\n{original}")
        
        if context:
            prompt += f"\n\nAdditional context to consider:\n{context}"
        
        try:
            response = self.client.generate_content(prompt)
            return self._post_process_answer(response.text, 'professional')
        except Exception as e:
            logger.error(f"Answer modification failed: {e}")
            return original
    
    def classify_and_generate(
        self,
        question_text: str,
        org_id: int,
        options: Dict = None
    ) -> Dict:
        """
        Convenience method that classifies the question and generates an answer.
        
        Combines classification, context retrieval, and answer generation.
        """
        from .classification_service import classification_service
        from .answer_reuse_service import answer_reuse_service
        from .qdrant_service import get_qdrant_service
        
        options = options or {}
        
        # Step 1: Classify the question
        classification = classification_service.classify_question(question_text)
        category = classification.get('category', 'general')
        sub_category = classification.get('sub_category')
        
        # Step 2: Get context from knowledge base
        context = []
        try:
            qdrant = get_qdrant_service()
            if qdrant.enabled:
                search_results = qdrant.search(
                    query=question_text,
                    org_id=org_id,
                    limit=5
                )
                context = [
                    {
                        'title': r.get('title', 'Knowledge Base'),
                        'content': r.get('content_preview', ''),
                        'relevance': r.get('score', 0),
                        'item_id': r.get('item_id'),
                        'category': r.get('category')
                    }
                    for r in search_results
                ]
        except Exception as e:
            logger.error(f"Context retrieval failed: {e}")
        
        # Step 3: Find similar approved answers
        similar_answers = answer_reuse_service.find_similar_answers(
            question_text, org_id, category, limit=2
        )
        
        # Step 4: Generate the answer
        result = self.generate_answer(
            question=question_text,
            context=context,
            tone=options.get('tone', 'professional'),
            length=options.get('length', 'medium'),
            similar_answers=similar_answers,
            question_category=category,
            sub_category=sub_category
        )
        
        # Add classification to result
        result['classification'] = classification
        
        return result


# Singleton instance
ai_service = AIService()
