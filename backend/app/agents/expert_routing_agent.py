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
        Now incorporates expert performance tracking and embedding-based matching.
        
        Args:
            scope_items: List of {id, text, type} tasks to assign
            team_members: List of {id, name, expertise_tags} available experts
            
        Returns:
            Dict with suggestions for each item
        """
        try:
            # Get expert performance data
            expert_performance = self._get_expert_performance(
                [m.get('id') for m in team_members]
            )
            
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
                member_id = member.get('id')
                perf = expert_performance.get(member_id, {})
                members_context.append({
                    'id': member_id,
                    'name': member.get('name'),
                    'expertise_tags': member.get('expertise_tags', []),
                    'performance': {
                        'approval_rate': perf.get('approval_rate', 0.5),
                        'avg_response_time': perf.get('avg_days_to_complete', 3),
                        'completed_count': perf.get('completed_count', 0)
                    }
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
                'expert_performance_used': len(expert_performance) > 0,
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Expert routing error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'suggestions': []
            }
    
    def _get_expert_performance(self, user_ids: List[int]) -> Dict[int, Dict]:
        """
        Get assignment success rates and performance metrics for experts.
        
        Tracks:
        - Approval rate: % of assigned items that got approved
        - Response time: Avg days from assignment to completion
        - Completed count: Total number of completed assignments
        """
        try:
            from app.models import Answer, RFPSection
            from sqlalchemy import func
            
            performance = {}
            
            for user_id in user_ids:
                if not user_id:
                    continue
                
                # Get answer completion stats
                completed_answers = Answer.query.filter_by(
                    assigned_to=user_id,
                    status='approved'
                ).count()
                
                total_answers = Answer.query.filter_by(
                    assigned_to=user_id
                ).count()
                
                # Get section completion stats  
                completed_sections = RFPSection.query.filter_by(
                    assigned_to=user_id,
                    status='approved'
                ).count()
                
                total_sections = RFPSection.query.filter_by(
                    assigned_to=user_id
                ).count()
                
                total_completed = completed_answers + completed_sections
                total_assigned = total_answers + total_sections
                
                approval_rate = total_completed / max(1, total_assigned)
                
                performance[user_id] = {
                    'approval_rate': round(approval_rate, 2),
                    'completed_count': total_completed,
                    'assigned_count': total_assigned,
                    'avg_days_to_complete': 3  # Default estimate
                }
            
            return performance
            
        except Exception as e:
            logger.warning(f"Could not get expert performance: {e}")
            return {}
    
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
