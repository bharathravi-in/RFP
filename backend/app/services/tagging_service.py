"""
AI Tagging Service.

Uses Gemini to automatically generate semantic tags for content.
"""
import logging
import json
from typing import List, Dict, Optional
from flask import current_app

logger = logging.getLogger(__name__)


class TaggingService:
    """Service for AI-powered tag generation."""
    
    TAGGING_PROMPT = """Analyze the following Q&A content and generate relevant semantic tags.

## Question
{question}

## Answer  
{answer}

## Instructions
Generate 4-8 relevant tags that describe:
1. Topic/subject area (e.g., security, compliance, infrastructure)
2. Industry domain if applicable (e.g., healthcare, finance, government)
3. Compliance/regulatory terms if mentioned (e.g., GDPR, SOC2, HIPAA)
4. Technical concepts (e.g., encryption, API, cloud)
5. Business concepts (e.g., pricing, support, SLA)

## Requirements
- Tags should be lowercase, single words or hyphenated phrases
- Be specific rather than generic
- Prioritize discoverability - what would someone search for?
- Return ONLY a JSON array of strings, no other text

## Example Output
["security", "encryption", "data-protection", "compliance", "soc2", "enterprise"]

Generate tags:"""

    CATEGORY_TAGS = {
        'security': ['security', 'compliance', 'data-protection'],
        'technical': ['technical', 'implementation', 'integration'],
        'pricing': ['pricing', 'cost', 'licensing'],
        'legal': ['legal', 'contract', 'terms'],
        'compliance': ['compliance', 'regulatory', 'certification'],
        'product': ['product', 'features', 'capabilities'],
    }

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self._client = None
        self._model_name = None
        self._is_adk = False
    
    def _init_client(self):
        """Initialize the LLM client using provider abstraction."""
        if self._client is not None:
            return
        
        try:
            # Try getting org-specific config first (preferred)
            if self.org_id:
                from app.agents.config import get_agent_config
                config = get_agent_config(org_id=self.org_id, agent_type='answer_generation')
                self._client = config.client
                self._model_name = config.model_name
                self._is_adk = config.is_adk_enabled
                return
        except Exception:
            pass
        
        # Fallback to llm_service_helper with environment config
        try:
            from app.services.llm_service_helper import get_llm_provider
            # Try to get a provider without org_id (uses env config)
            if self.org_id:
                provider = get_llm_provider(self.org_id, 'tagging')
                self._client = provider
                self._model_name = getattr(provider, 'model', 'unknown')
                self._is_adk = False
        except Exception as e:
            logger.warning(f"Could not initialize LLM provider: {e}")
            self._client = None
    
    def generate_tags(
        self,
        question: str,
        answer: str,
        existing_category: str = None
    ) -> List[str]:
        """
        Generate semantic tags for a Q&A pair.
        
        Args:
            question: The question text
            answer: The answer text
            existing_category: Optional category to include related tags
            
        Returns:
            List of generated tags (4-8 items)
        """
        self._init_client()
        
        if not self._client:
            logger.warning("AI client not available, using fallback tags")
            return self._fallback_tags(question, existing_category)
        
        try:
            prompt = self.TAGGING_PROMPT.format(
                question=question[:500],  # Limit input length
                answer=answer[:1500]
            )
            
            if self._is_adk:
                response = self._client.models.generate_content(
                    model=self._model_name,
                    contents=prompt
                )
                text = response.text
            else:
                response = self._client.generate_content(prompt)
                text = response.text
            
            # Parse JSON response
            tags = self._parse_tags(text)
            
            # Add category-based tags if not present
            if existing_category and existing_category in self.CATEGORY_TAGS:
                category_tags = self.CATEGORY_TAGS[existing_category]
                for tag in category_tags[:2]:  # Add up to 2 category tags
                    if tag not in tags:
                        tags.append(tag)
            
            # Ensure reasonable tag count
            tags = tags[:8]
            
            logger.info(f"Generated {len(tags)} tags for content")
            return tags
            
        except Exception as e:
            logger.error(f"Tag generation failed: {e}")
            return self._fallback_tags(question, existing_category)
    
    def _parse_tags(self, response_text: str) -> List[str]:
        """Parse tags from AI response."""
        try:
            # Try direct JSON parse
            text = response_text.strip()
            
            # Find JSON array in response
            start = text.find('[')
            end = text.rfind(']') + 1
            
            if start >= 0 and end > start:
                json_str = text[start:end]
                tags = json.loads(json_str)
                
                # Validate and clean tags
                cleaned = []
                for tag in tags:
                    if isinstance(tag, str):
                        tag = tag.lower().strip().replace(' ', '-')
                        if 2 <= len(tag) <= 30 and tag not in cleaned:
                            cleaned.append(tag)
                
                return cleaned
            
            return []
            
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Failed to parse tags: {e}")
            return []
    
    def _fallback_tags(self, question: str, category: str = None) -> List[str]:
        """Generate basic tags when AI is unavailable."""
        tags = []
        
        # Add category-based tags
        if category and category in self.CATEGORY_TAGS:
            tags.extend(self.CATEGORY_TAGS[category])
        
        # Extract keywords from question
        keywords = ['security', 'compliance', 'data', 'support', 'pricing',
                   'integration', 'api', 'cloud', 'encryption', 'backup',
                   'uptime', 'sla', 'training', 'implementation']
        
        question_lower = question.lower()
        for keyword in keywords:
            if keyword in question_lower and keyword not in tags:
                tags.append(keyword)
        
        return tags[:6] or ['general']
    
    def suggest_tags(self, partial_text: str, limit: int = 10) -> List[str]:
        """
        Suggest tags based on partial text (for autocomplete).
        
        Args:
            partial_text: Beginning of a tag to match
            limit: Maximum suggestions to return
            
        Returns:
            List of suggested tag strings
        """
        from app.models import AnswerLibraryItem
        from sqlalchemy import func
        
        # Get existing tags from the library
        partial_lower = partial_text.lower().strip()
        
        try:
            # Query for items with matching tags
            items = AnswerLibraryItem.query.filter(
                AnswerLibraryItem.is_active == True
            ).all()
            
            # Collect and count tags
            tag_counts: Dict[str, int] = {}
            for item in items:
                for tag in (item.tags or []):
                    tag_lower = tag.lower()
                    if tag_lower.startswith(partial_lower):
                        tag_counts[tag_lower] = tag_counts.get(tag_lower, 0) + 1
            
            # Sort by frequency and return top matches
            sorted_tags = sorted(
                tag_counts.items(),
                key=lambda x: (-x[1], x[0])
            )
            
            return [tag for tag, _ in sorted_tags[:limit]]
            
        except Exception as e:
            logger.error(f"Tag suggestion failed: {e}")
            return []


def get_tagging_service(org_id: int = None) -> TaggingService:
    """Get tagging service instance."""
    return TaggingService(org_id=org_id)
