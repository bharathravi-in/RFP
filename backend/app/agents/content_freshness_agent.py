"""
Content Freshness Agent

AI-powered agent for monitoring the accuracy and relevance of the Answer Library.
Identifies outdated information by comparing library items with newly uploaded documents.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class ContentFreshnessAgent:
    """
    Agent for ensuring the knowledge base remains fresh and accurate.
    
    Features:
    - Compare library answers with new document context
    - Identify direct contradictions or outdated facts
    - Suggest updates or flags for review
    """
    
    MASTER_PROMPT = """You are a Knowledge Management Specialist and Content Auditor.
Your task is to audit a set of "Library Answers" against "New Project Documents" to identify any information that is now outdated, incorrect, or contradictory.

## New Project Context:
{project_context}

## Library Items to Audit:
{library_items}

## Output Format:
Generate a JSON response with the following structure:
{{
  "audits": [
    {{
      "item_id": "ID of the library item",
      "status": "up_to_date|outdated|contradictory|uncertain",
      "confidence_score": 0.0 to 1.0,
      "findings": "Explanation of what changed or why it is outdated",
      "suggested_update": "Optional: Revised answer text based on new context",
      "referenced_doc_id": "ID of the new document that caused the flag"
    }}
  ]
}}

## Guidelines:
1. Be extremely vigilant about dates, version numbers, pricing, and technical specifications.
2. If the new context contains a newer version of a software or a changed policy, flag the library item as "outdated".
3. If the new context explicitly states something that contradicts the library answer, flag as "contradictory".
4. If the library item is still accurate, flag as "up_to_date".

Audit the content now:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='content_freshness')
        logger.info(f"ContentFreshnessAgent initialized")
    
    def audit_content(
        self,
        library_items: List[Dict[str, Any]],
        project_context: str
    ) -> Dict[str, Any]:
        """
        Audit library items against new project context.
        
        Args:
            library_items: List of {id, question_text, answer_text} from library
            project_context: Aggregated text from new documents
            
        Returns:
            Dict with audit results
        """
        try:
            # Build context
            items_context = []
            for item in library_items:
                items_context.append({
                    'id': item.get('id'),
                    'question': item.get('question_text'),
                    'answer': item.get('answer_text')
                })
            
            prompt = self.MASTER_PROMPT.format(
                project_context=project_context[:15000],  # Limit context for prompt size
                library_items=json.dumps(items_context, indent=2)
            )
            
            logger.info(f"Auditing {len(library_items)} library items for freshness")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.1,  # Very low temperature for accuracy
                max_tokens=4000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            return {
                'success': True,
                'audits': result.get('audits', []),
                'audit_count': len(result.get('audits', [])),
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Content freshness audit error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'audits': []
            }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract JSON."""
        try:
            text = response_text.strip()
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1])
            text = text.strip()
            
            return json.loads(text)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
            
            logger.warning("Could not parse freshness audit results")
            return {}


def get_content_freshness_agent(org_id: int = None) -> ContentFreshnessAgent:
    """Factory function to get Content Freshness Agent."""
    return ContentFreshnessAgent(org_id=org_id)
