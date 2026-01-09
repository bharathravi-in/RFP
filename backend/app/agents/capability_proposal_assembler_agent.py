"""
Capability Proposal Assembler Agent

Assembles final proposal sections for Capability-Led Proposals.
Unlike RFP-driven proposals, this creates sections without RFP questions.

Generates the 8-section structure:
1. Executive Summary
2. Understanding Your Product & Vision
3. Industry & Market Context
4. Where We Align Strongly
5. Our Relevant Footprints
6. How This Creates a Win-Win Partnership
7. Engagement Approach
8. Next Steps
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class CapabilityProposalAssemblerAgent:
    """
    Agent for assembling capability-led proposal sections.
    
    This agent creates the final proposal structure for sales-led pitches.
    
    Features:
    - Assemble sections from processed components
    - Generate missing sections
    - Ensure narrative flow
    - Create executive-ready content
    
    LLM: ✅ | KB: ✅
    """
    
    # Section structure for capability-led proposals
    SECTION_STRUCTURE = [
        {
            'id': 'executive_summary',
            'name': 'Executive Summary',
            'order': 1,
            'description': 'High-level overview of the partnership opportunity'
        },
        {
            'id': 'understanding_client',
            'name': 'Understanding Your Product & Vision',
            'order': 2,
            'description': 'Demonstrates deep understanding of client business'
        },
        {
            'id': 'industry_context',
            'name': 'Industry & Market Context',
            'order': 3,
            'description': 'Industry insights and market positioning'
        },
        {
            'id': 'capability_alignment',
            'name': 'Where We Align Strongly',
            'order': 4,
            'description': 'Mapping of capabilities to client needs'
        },
        {
            'id': 'footprints',
            'name': 'Our Relevant Footprints',
            'order': 5,
            'description': 'Case studies and proof points'
        },
        {
            'id': 'win_win_value',
            'name': 'How This Creates a Win-Win Partnership',
            'order': 6,
            'description': 'Mutual value proposition'
        },
        {
            'id': 'engagement_approach',
            'name': 'Engagement Approach',
            'order': 7,
            'description': 'How we will work together'
        },
        {
            'id': 'next_steps',
            'name': 'Next Steps',
            'order': 8,
            'description': 'Concrete actions to move forward'
        }
    ]
    
    MASTER_PROMPT = """You are an Executive Proposal Writer assembling a capability-led proposal.

Your task is to generate polished proposal sections from the provided components.

## Client Context:
{client_context}

## Capability Alignments:
{alignments}

## Footprint Narratives:
{footprints}

## Win-Win Value:
{win_win}

## Section to Generate: {section_id}
Section Name: {section_name}
Section Purpose: {section_description}

## Output Format
Generate a JSON response with the following structure:
{{
    "section_id": "{section_id}",
    "title": "Section title (can be customized)",
    "content": "The full section content in markdown format. Use ## for sub-headings, bullet points, and emphasis appropriately.",
    "key_messages": ["Key message 1", "Key message 2"],
    "word_count": 250,
    "executive_summary_point": "One-sentence summary for exec summary"
}}

## Guidelines:
1. Write in professional but engaging tone
2. Lead with client value, not vendor capabilities
3. Use specific numbers and proof points
4. Keep executive audience in mind
5. Ensure logical flow from previous sections
6. Make it actionable where appropriate

Generate the section content:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='capability_assembler')
        logger.info(f"CapabilityProposalAssemblerAgent initialized with provider: {self.config.provider}")
    
    def assemble_proposal(
        self,
        client_context: Dict[str, Any],
        alignments: List[Dict] = None,
        footprint_narrative: Dict[str, Any] = None,
        win_win_value: Dict[str, Any] = None,
        sections_to_generate: List[str] = None
    ) -> Dict[str, Any]:
        """
        Assemble complete capability-led proposal.
        
        Args:
            client_context: Structured client context
            alignments: Capability alignments
            footprint_narrative: Generated footprint stories
            win_win_value: Win-win value proposition
            sections_to_generate: Specific sections to generate (default: all)
            
        Returns:
            Dict with all generated sections
        """
        try:
            sections_to_generate = sections_to_generate or [s['id'] for s in self.SECTION_STRUCTURE]
            
            generated_sections = []
            
            for section in self.SECTION_STRUCTURE:
                if section['id'] not in sections_to_generate:
                    continue
                
                logger.info(f"Generating section: {section['name']}")
                
                section_content = self._generate_section(
                    section_id=section['id'],
                    section_name=section['name'],
                    section_description=section['description'],
                    client_context=client_context,
                    alignments=alignments,
                    footprints=footprint_narrative,
                    win_win=win_win_value
                )
                
                generated_sections.append({
                    'section_id': section['id'],
                    'name': section['name'],
                    'order': section['order'],
                    'content': section_content.get('content', ''),
                    'key_messages': section_content.get('key_messages', []),
                })
            
            return {
                'success': True,
                'sections': generated_sections,
                'section_count': len(generated_sections),
                'structure': self.SECTION_STRUCTURE,
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Proposal assembly error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'sections': [],
                'generated_at': datetime.utcnow().isoformat(),
            }
    
    def _generate_section(
        self,
        section_id: str,
        section_name: str,
        section_description: str,
        client_context: Dict,
        alignments: List[Dict],
        footprints: Dict,
        win_win: Dict
    ) -> Dict:
        """Generate a single section."""
        try:
            prompt = self.MASTER_PROMPT.format(
                client_context=json.dumps(client_context, indent=2),
                alignments=json.dumps(alignments or [], indent=2),
                footprints=json.dumps(footprints or {}, indent=2),
                win_win=json.dumps(win_win or {}, indent=2),
                section_id=section_id,
                section_name=section_name,
                section_description=section_description
            )
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.6,
                max_tokens=2000
            )
            
            result = self._parse_response(response_text)
            
            if not result or not result.get('content'):
                return self._generate_fallback_section(section_id, section_name, client_context)
            
            return result
            
        except Exception as e:
            logger.warning(f"Section generation failed for {section_id}: {e}")
            return self._generate_fallback_section(section_id, section_name, client_context)
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract section JSON."""
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
            
            logger.warning("Could not parse section response")
            return {}
    
    def _generate_fallback_section(self, section_id: str, section_name: str, client_context: Dict) -> Dict:
        """Generate fallback section content."""
        client_name = client_context.get('client_overview', {}).get('company_name', 'the client')
        
        fallback_content = {
            'executive_summary': f"We are excited to present this proposal to {client_name}. Our capabilities align strongly with your strategic needs, and we believe this partnership will create significant value for both organizations.",
            'understanding_client': f"We understand that {client_name} is focused on growth and innovation in your market. Your product and vision resonate with our expertise.",
            'industry_context': "The industry is evolving rapidly, and organizations that embrace digital transformation are positioned for success.",
            'capability_alignment': "Our capabilities map directly to your identified needs, providing a strong foundation for partnership.",
            'footprints': "We have delivered similar solutions across multiple industries, demonstrating our proven track record.",
            'win_win_value': "This partnership creates value for both parties through shared success and mutual growth.",
            'engagement_approach': "We propose a collaborative engagement model that adapts to your needs.",
            'next_steps': "We recommend a discovery workshop as the first step to align on detailed requirements.",
        }
        
        return {
            'section_id': section_id,
            'title': section_name,
            'content': fallback_content.get(section_id, 'Content to be developed.'),
            'key_messages': ['Partnership', 'Value', 'Expertise'],
            '_fallback': True
        }
    
    def generate_single_section(
        self,
        section_id: str,
        client_context: Dict[str, Any],
        alignments: List[Dict] = None,
        footprint_narrative: Dict[str, Any] = None,
        win_win_value: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Generate a single section (for regeneration)."""
        section = next((s for s in self.SECTION_STRUCTURE if s['id'] == section_id), None)
        
        if not section:
            return {'success': False, 'error': f'Unknown section: {section_id}'}
        
        content = self._generate_section(
            section_id=section['id'],
            section_name=section['name'],
            section_description=section['description'],
            client_context=client_context,
            alignments=alignments,
            footprints=footprint_narrative,
            win_win=win_win_value
        )
        
        return {
            'success': True,
            'section': {
                'section_id': section['id'],
                'name': section['name'],
                'order': section['order'],
                'content': content.get('content', ''),
                'key_messages': content.get('key_messages', []),
            }
        }


def get_capability_proposal_assembler(org_id: int = None) -> CapabilityProposalAssemblerAgent:
    """Factory function to get Capability Proposal Assembler Agent."""
    return CapabilityProposalAssemblerAgent(org_id=org_id)
