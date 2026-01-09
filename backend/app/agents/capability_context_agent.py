"""
Capability Context Agent

Converts raw meeting notes and client information into structured proposal context
for Capability-Led Proposals (vendor-driven, sales-led proposals without RFP).

Uses configured LLM provider from organization settings.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class CapabilityContextAgent:
    """
    Agent for processing client meeting notes into structured proposal context.
    
    This is the first step in the Capability-Led Proposal pipeline.
    
    Features:
    - Extract key client information from unstructured notes
    - Identify client needs and challenges
    - Understand decision criteria
    - Structure context for downstream agents
    
    LLM: ✅ | KB: ✅ (for domain expertise)
    """
    
    MASTER_PROMPT = """You are a Senior Business Analyst preparing for a capability-led proposal.

Your task is to analyze client meeting notes and extract structured information for proposal development.

## Input Data:
{context}

## Output Format
Generate a JSON response with the following structure:
{{
    "client_overview": {{
        "company_name": "Client company name",
        "industry": "Primary industry/domain",
        "size": "Enterprise/Mid-Market/SMB",
        "product_summary": "Brief description of client's product/service",
        "market_position": "Their position in the market"
    }},
    "identified_needs": [
        {{
            "need_id": "N-001",
            "category": "Technology/Process/Strategy/Growth",
            "description": "What the client needs",
            "urgency": "High/Medium/Low",
            "source": "Explicit mention OR inferred from context",
            "keywords": ["relevant", "keywords"]
        }}
    ],
    "challenges": [
        {{
            "challenge_id": "C-001",
            "description": "Challenge they face",
            "impact": "Business impact if not addressed",
            "related_needs": ["N-001"]
        }}
    ],
    "strategic_goals": [
        {{
            "goal_id": "G-001",
            "description": "Strategic goal",
            "timeframe": "Short-term/Mid-term/Long-term",
            "priority": "High/Medium/Low"
        }}
    ],
    "decision_criteria": [
        {{
            "criterion": "What matters for their decision",
            "importance": "Critical/Important/Nice-to-have",
            "notes": "Any context about this criterion"
        }}
    ],
    "key_stakeholders": [
        {{
            "role": "Their role/title",
            "concerns": "What they care about",
            "influence": "Decision-maker/Influencer/User"
        }}
    ],
    "opportunity_assessment": {{
        "fit_score": 0.85,
        "fit_rationale": "Why this is a good/challenging fit",
        "key_differentiators_needed": ["What we need to highlight"],
        "potential_risks": ["Risks to address"],
        "recommended_approach": "How to position our proposal"
    }},
    "proposal_themes": [
        "Theme 1: Innovation partner",
        "Theme 2: Proven expertise"
    ]
}}

## Guidelines:
1. Extract both explicit and implicit needs from the notes
2. Prioritize based on business impact
3. Identify decision criteria even if not directly stated
4. Consider stakeholder dynamics
5. Be realistic about fit assessment
6. Suggest themes that would resonate with this client

Analyze the meeting context now:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='capability_context')
        logger.info(f"CapabilityContextAgent initialized with provider: {self.config.provider}")
    
    def process_context(
        self,
        meeting_notes: str,
        client_name: str = None,
        client_product: str = None,
        client_domain: str = None,
        client_goals: List[str] = None,
        client_challenges: List[str] = None,
        additional_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Process client meeting notes into structured context.
        
        Args:
            meeting_notes: Raw meeting notes (free text)
            client_name: Client company name (if known)
            client_product: Description of client's product/service
            client_domain: Industry/domain
            client_goals: User-provided strategic goals
            client_challenges: User-provided challenges
            additional_context: Any additional context
            
        Returns:
            Dict with structured context for proposal development
        """
        try:
            # Build input context
            context = self._build_input_context(
                meeting_notes=meeting_notes,
                client_name=client_name,
                client_product=client_product,
                client_domain=client_domain,
                client_goals=client_goals,
                client_challenges=client_challenges,
                additional_context=additional_context
            )
            
            # Generate structured context using AI
            prompt = self.MASTER_PROMPT.format(
                context=json.dumps(context, indent=2)
            )
            
            logger.info(f"Processing capability context for: {client_name or 'Unknown Client'}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.5,  # More analytical, less creative
                max_tokens=4000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            if not result:
                result = self._generate_fallback_context(context)
            
            return {
                'success': True,
                'structured_context': result,
                'identified_needs': result.get('identified_needs', []),
                'challenges': result.get('challenges', []),
                'strategic_goals': result.get('strategic_goals', []),
                'decision_criteria': result.get('decision_criteria', []),
                'opportunity_assessment': result.get('opportunity_assessment', {}),
                'proposal_themes': result.get('proposal_themes', []),
                'processed_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Capability context processing error: {str(e)}")
            fallback = self._generate_fallback_context({
                'client_name': client_name,
                'client_domain': client_domain,
                'meeting_notes': meeting_notes
            })
            return {
                'success': False,
                'error': str(e),
                'structured_context': fallback,
                'identified_needs': fallback.get('identified_needs', []),
                'processed_at': datetime.utcnow().isoformat(),
            }
    
    def _build_input_context(
        self,
        meeting_notes: str,
        client_name: str = None,
        client_product: str = None,
        client_domain: str = None,
        client_goals: List[str] = None,
        client_challenges: List[str] = None,
        additional_context: Dict[str, Any] = None
    ) -> Dict:
        """Build input context for the AI prompt."""
        return {
            'client_name': client_name or 'Unknown Client',
            'client_product': client_product,
            'client_domain': client_domain,
            'meeting_notes': meeting_notes,
            'user_identified_goals': client_goals or [],
            'user_identified_challenges': client_challenges or [],
            'additional_context': additional_context or {}
        }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract structured context JSON."""
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
            
            logger.warning("Could not parse capability context response")
            return {}
    
    def _generate_fallback_context(self, input_context: Dict) -> Dict:
        """Generate fallback context when AI fails."""
        return {
            'client_overview': {
                'company_name': input_context.get('client_name', 'Unknown Client'),
                'industry': input_context.get('client_domain', 'General'),
                'product_summary': input_context.get('client_product', ''),
            },
            'identified_needs': [
                {
                    'need_id': 'N-001',
                    'category': 'Technology',
                    'description': 'Digital transformation needs',
                    'urgency': 'Medium',
                    'source': 'Inferred',
                }
            ],
            'challenges': [],
            'strategic_goals': [],
            'decision_criteria': [
                {
                    'criterion': 'Technical capability',
                    'importance': 'Critical',
                }
            ],
            'opportunity_assessment': {
                'fit_score': 0.5,
                'fit_rationale': 'Requires more context for accurate assessment',
            },
            'proposal_themes': [
                'Partnership and collaboration',
                'Proven delivery capability'
            ],
            '_fallback': True
        }


def get_capability_context_agent(org_id: int = None) -> CapabilityContextAgent:
    """Factory function to get Capability Context Agent."""
    return CapabilityContextAgent(org_id=org_id)
