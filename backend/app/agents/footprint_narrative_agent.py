"""
Footprint Narrative Agent

Converts case studies and metrics into compelling narrative paragraphs.
Unlike RFP-style compliance tables, this produces story-based credibility content.

Used in Capability-Led Proposals to showcase proven track record.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class FootprintNarrativeAgent:
    """
    Agent for transforming case studies into compelling narrative stories.
    
    This agent converts structured proof points into persuasive prose.
    
    Features:
    - Turn metrics into stories
    - Create credibility narratives
    - Highlight relevant experience
    - Connect proof to client needs
    
    LLM: ✅ | KB: ✅
    """
    
    MASTER_PROMPT = """You are an Executive Storyteller creating compelling credibility narratives for a proposal.

Your task is to transform case studies and metrics into persuasive prose that demonstrates our proven capability.

## Client Context:
{client_context}

## Case Studies to Highlight:
{case_studies}

## Capability Alignments:
{alignments}

## Output Format
Generate a JSON response with the following structure:
{{
    "opening_narrative": "A compelling 2-3 sentence opening that establishes credibility",
    
    "footprint_stories": [
        {{
            "story_id": "FS-001",
            "headline": "Transforming [Industry] Operations at Scale",
            "narrative": "A 3-4 paragraph story incorporating the case study...",
            "key_metrics_embedded": ["40% reduction", "6 months"],
            "client_parallel": "How this relates to the current client",
            "proof_source": "CS-001",
            "word_count": 150
        }}
    ],
    
    "metrics_highlight": {{
        "aggregate_headline": "Delivering Measurable Impact Across [X] Projects",
        "metrics_narrative": "Paragraph summarizing key metrics across all proof points",
        "key_numbers": [
            {{"value": "50+", "context": "enterprise transformations"}},
            {{"value": "40%", "context": "average cost reduction"}},
            {{"value": "99.9%", "context": "uptime achieved"}}
        ]
    }},
    
    "industry_credibility": {{
        "headline": "Deep [Industry] Expertise",
        "narrative": "Paragraph establishing industry credibility",
        "specific_experience": ["Healthcare", "Finance", "Retail"]
    }},
    
    "closing_statement": "A powerful closing statement connecting our track record to client success"
}}

## Guidelines:
1. Write in confident but not arrogant tone
2. Embed metrics naturally within narrative (don't list them)
3. Focus on CLIENT OUTCOMES, not our activities
4. Make explicit connections to the current client's needs
5. Use specific numbers when available
6. Keep each story focused and impactful
7. Write for executive audience (busy, outcome-focused)

Transform these proof points into narratives now:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='footprint_narrative')
        logger.info(f"FootprintNarrativeAgent initialized with provider: {self.config.provider}")
    
    def generate_narrative(
        self,
        client_context: Dict[str, Any],
        case_studies: List[Dict] = None,
        alignments: List[Dict] = None,
        metrics: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate narrative stories from case studies and metrics.
        
        Args:
            client_context: Client context for relevance
            case_studies: Case studies to convert to narratives
            alignments: Capability alignments (for connecting proof to needs)
            metrics: Additional metrics to highlight
            
        Returns:
            Dict with narrative content
        """
        try:
            # Generate narrative using AI
            prompt = self.MASTER_PROMPT.format(
                client_context=json.dumps(client_context, indent=2),
                case_studies=json.dumps(case_studies or [], indent=2),
                alignments=json.dumps(alignments or [], indent=2)
            )
            
            logger.info(f"Generating footprint narratives for org={self.org_id}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.7,  # More creative for narratives
                max_tokens=4000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            if not result:
                result = self._generate_fallback_narrative(case_studies)
            
            return {
                'success': True,
                'opening_narrative': result.get('opening_narrative', ''),
                'footprint_stories': result.get('footprint_stories', []),
                'metrics_highlight': result.get('metrics_highlight', {}),
                'industry_credibility': result.get('industry_credibility', {}),
                'closing_statement': result.get('closing_statement', ''),
                'story_count': len(result.get('footprint_stories', [])),
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Footprint narrative error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'opening_narrative': '',
                'footprint_stories': [],
                'generated_at': datetime.utcnow().isoformat(),
            }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract narrative JSON."""
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
            
            logger.warning("Could not parse footprint narrative response")
            return {}
    
    def _generate_fallback_narrative(self, case_studies: List[Dict]) -> Dict:
        """Generate fallback narrative when AI fails."""
        stories = []
        for i, cs in enumerate((case_studies or [])[:3]):
            stories.append({
                'story_id': f'FS-{i+1:03d}',
                'headline': cs.get('title', 'Successful Project Delivery'),
                'narrative': f"In our work with {cs.get('client_type', 'enterprises')}, we delivered {cs.get('solution', 'transformative solutions')}.",
                'proof_source': cs.get('case_id', f'CS-{i+1:03d}'),
            })
        
        return {
            'opening_narrative': 'We bring proven expertise across industries.',
            'footprint_stories': stories,
            'metrics_highlight': {
                'aggregate_headline': 'Delivering Measurable Results',
                'key_numbers': [{'value': '100+', 'context': 'projects delivered'}]
            },
            'closing_statement': 'Our track record speaks to our commitment to client success.',
            '_fallback': True
        }


def get_footprint_narrative_agent(org_id: int = None) -> FootprintNarrativeAgent:
    """Factory function to get Footprint Narrative Agent."""
    return FootprintNarrativeAgent(org_id=org_id)
