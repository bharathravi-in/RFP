"""
Expert Routing Agent

AI-powered agent for automatically suggesting the best owners for proposal sections and questions
based on their expertise tags and workload.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class ExpertRoutingAgent:
    """
    Agent for analyzing proposal content and routing it to the most relevant expert.
    
    Features:
    - Map section/question requirements to user expertise tags
    - Suggest primary and secondary owners
    - Provide reasoning for the assignment
    """
    
    MASTER_PROMPT = """You are a Proposal Operations Manager and Resource Coordinator.
Your task is to analyze proposal requirements (sections or questions) and suggest the best expert from the team to handle them.

## Team Members:
{team_members}

## Scope Items to Route:
{scope_items}

## Output Format:
Generate a JSON response with the following structure:
{{
  "suggestions": [
    {{
      "item_id": "ID of the section or question",
      "suggested_owner_id": "ID of the best-fit user",
      "confidence_score": 0.0 to 1.0,
      "reasoning": "Brief explanation of why this user is a good match based on their expertise tags",
      "secondary_owner_id": "ID of an alternative user",
      "expertise_match_category": "The specific expertise tag that matched"
    }}
  ]
}}

## Guidelines:
1. Match keywords from the item text (e.g., "security", "cloud", "pricing") with user expertise tags.
2. If no direct tag match exists, use semantic similarity to find the closest expert.
3. Suggest a confidence score based on how well the expertise aligns.
4. Keep the reasoning concise.

Analyze and suggest the routing now:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='expert_routing')
        logger.info(f"ExpertRoutingAgent initialized")
    
    def suggest_owners(
        self,
        scope_items: List[Dict[str, Any]],
        team_members: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Suggest owners for sections or questions.
        
        Args:
            scope_items: List of {id, text, type} tasks to assign
            team_members: List of {id, name, expertise_tags} available experts
            
        Returns:
            Dict with suggestions for each item
        """
        try:
            # Build context
            items_context = []
            for item in scope_items:
                items_context.append({
                    'id': item.get('id'),
                    'text': item.get('text') or item.get('title') or "",
                    'type': item.get('type', 'question')
                })
            
            members_context = []
            for member in team_members:
                members_context.append({
                    'id': member.get('id'),
                    'name': member.get('name'),
                    'expertise_tags': member.get('expertise_tags', [])
                })
            
            prompt = self.MASTER_PROMPT.format(
                team_members=json.dumps(members_context, indent=2),
                scope_items=json.dumps(items_context, indent=2)
            )
            
            logger.info(f"Suggesting owners for {len(scope_items)} items")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.2,  # Low temperature for precise matching
                max_tokens=3000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            return {
                'success': True,
                'suggestions': result.get('suggestions', []),
                'routing_count': len(result.get('suggestions', [])),
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Expert routing error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'suggestions': []
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
            
            logger.warning("Could not parse routing suggestions")
            return {}


def get_expert_routing_agent(org_id: int = None) -> ExpertRoutingAgent:
    """Factory function to get Expert Routing Agent."""
    return ExpertRoutingAgent(org_id=org_id)
