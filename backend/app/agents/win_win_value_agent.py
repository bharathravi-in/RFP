"""
Win-Win Value Agent

Generates explicit value propositions for both client and vendor.
Creates the partnership narrative that distinguishes capability-led proposals.

This is critical for sales-led proposals - showing mutual benefit.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class WinWinValueAgent:
    """
    Agent for generating mutual value propositions.
    
    Unlike RFP responses (one-way value), this creates bidirectional value.
    
    Features:
    - Client value articulation
    - Vendor value articulation (reference, growth, etc.)
    - Partnership positioning
    - Long-term vision narrative
    
    LLM: ✅ | KB: ❌
    """
    
    MASTER_PROMPT = """You are a Strategic Partnership Consultant framing a win-win value proposition.

Your task is to articulate the value for BOTH parties - the client AND our company.

## Client Context:
{client_context}

## Capability Alignments:
{alignments}

## Our Strategic Interests:
{vendor_interests}

## Output Format
Generate a JSON response with the following structure:
{{
    "client_value": {{
        "headline": "What [Client] Gains",
        "primary_benefits": [
            {{
                "benefit": "Accelerated time-to-market",
                "how_delivered": "Through our proven agile methodology",
                "quantification": "3 months faster than typical approach",
                "proof": "Based on similar implementations"
            }}
        ],
        "strategic_advantages": [
            "Access to enterprise-grade expertise",
            "Reduced implementation risk"
        ],
        "long_term_value": "Description of ongoing value beyond initial project"
    }},
    
    "vendor_value": {{
        "headline": "Why This Partnership Matters to Us",
        "strategic_benefits": [
            {{
                "benefit": "Reference in [industry]",
                "significance": "Expands our healthcare portfolio",
                "commitment_signal": "We're investing senior resources"
            }}
        ],
        "growth_opportunities": [
            "Long-term partnership potential",
            "Innovation collaboration"
        ],
        "why_we_care": "Authentic statement about why this client matters"
    }},
    
    "partnership_vision": {{
        "headline": "Building a Strategic Partnership",
        "narrative": "2-3 paragraph narrative about the partnership vision",
        "milestones": [
            {{"phase": "Year 1", "vision": "Successful initial delivery"}},
            {{"phase": "Year 2-3", "vision": "Expanded scope"}},
            {{"phase": "Long-term", "vision": "Strategic technology partner"}}
        ],
        "mutual_growth": "How both parties grow together"
    }},
    
    "engagement_model": {{
        "recommended_approach": "Partnership/Project/Retainer",
        "rationale": "Why this model works for both parties",
        "flexibility_offered": "How we can adapt to their needs"
    }},
    
    "next_steps": [
        {{
            "action": "Discovery workshop",
            "owner": "Joint",
            "timeframe": "Week 1",
            "outcome": "Detailed requirements and alignment"
        }}
    ]
}}

## Guidelines:
1. Be AUTHENTIC about vendor value - not everything is about money
2. Show genuine strategic interest in the client
3. Make client value specific and quantified where possible
4. Partnership vision should feel aspirational but achievable
5. Avoid generic statements - be specific to this client
6. Balance ambition with realism

Generate the win-win value proposition:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='win_win_value')
        logger.info(f"WinWinValueAgent initialized with provider: {self.config.provider}")
    
    def generate_win_win(
        self,
        client_context: Dict[str, Any],
        alignments: List[Dict] = None,
        vendor_interests: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Generate win-win value proposition.
        
        Args:
            client_context: Structured client context
            alignments: Capability alignments
            vendor_interests: What vendor hopes to gain (optional)
            
        Returns:
            Dict with win-win value proposition
        """
        try:
            # Default vendor interests if not provided
            if not vendor_interests:
                vendor_interests = self._get_default_vendor_interests(client_context)
            
            # Generate win-win using AI
            prompt = self.MASTER_PROMPT.format(
                client_context=json.dumps(client_context, indent=2),
                alignments=json.dumps(alignments or [], indent=2),
                vendor_interests=json.dumps(vendor_interests, indent=2)
            )
            
            logger.info(f"Generating win-win value for org={self.org_id}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.6,
                max_tokens=4000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            if not result:
                result = self._generate_fallback_win_win(client_context)
            
            return {
                'success': True,
                'client_value': result.get('client_value', {}),
                'vendor_value': result.get('vendor_value', {}),
                'partnership_vision': result.get('partnership_vision', {}),
                'engagement_model': result.get('engagement_model', {}),
                'next_steps': result.get('next_steps', []),
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Win-win value generation error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'client_value': {},
                'vendor_value': {},
                'generated_at': datetime.utcnow().isoformat(),
            }
    
    def _get_default_vendor_interests(self, client_context: Dict) -> Dict:
        """Get default vendor interests based on client context."""
        industry = client_context.get('client_overview', {}).get('industry', 'General')
        
        return {
            'strategic_interests': [
                f'Reference client in {industry}',
                'Long-term partnership opportunity',
                'Portfolio expansion'
            ],
            'growth_areas': [
                'Industry expertise deepening',
                'Innovation collaboration'
            ],
            'team_development': 'Opportunity for team growth and learning'
        }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract win-win JSON."""
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
            
            logger.warning("Could not parse win-win value response")
            return {}
    
    def _generate_fallback_win_win(self, client_context: Dict) -> Dict:
        """Generate fallback win-win when AI fails."""
        client_name = client_context.get('client_overview', {}).get('company_name', 'the client')
        
        return {
            'client_value': {
                'headline': f'Value for {client_name}',
                'primary_benefits': [
                    {'benefit': 'Accelerated delivery', 'how_delivered': 'Proven methodology'}
                ],
                'strategic_advantages': ['Access to expert team', 'Reduced risk'],
            },
            'vendor_value': {
                'headline': 'Why This Partnership Matters',
                'strategic_benefits': [
                    {'benefit': 'Industry reference', 'significance': 'Portfolio growth'}
                ],
            },
            'partnership_vision': {
                'headline': 'Building a Strategic Partnership',
                'narrative': 'We envision a long-term partnership built on mutual success.',
            },
            'next_steps': [
                {'action': 'Initial discussion', 'timeframe': 'This week'}
            ],
            '_fallback': True
        }


def get_win_win_value_agent(org_id: int = None) -> WinWinValueAgent:
    """Factory function to get Win-Win Value Agent."""
    return WinWinValueAgent(org_id=org_id)
