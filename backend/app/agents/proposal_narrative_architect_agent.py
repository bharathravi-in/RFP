"""
Proposal Narrative Architect Agent

The CRITICAL foundation agent that owns the story of the proposal.
Acts as a single source of truth for all content-generating agents.

Responsibilities:
- Extract client problem statement (single source of truth)
- Define solution thesis (1-2 sentences)
- Establish value pillars (3 max)
- Set proposal tone
- Identify client constraints and non-negotiables

Every other agent MUST consume this output to ensure narrative coherence.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class ProposalNarrativeArchitectAgent:
    """
    The Chief Editor agent that ensures proposal coherence.
    
    This agent runs FIRST before any content generation and produces
    a narrative context that all other agents must reference.
    
    Features:
    - Extracts single source of truth for client problem
    - Defines solution thesis and value pillars
    - Sets proposal tone and voice
    - Identifies constraints and non-negotiables
    - Prevents generic enterprise filler by grounding all content
    """
    
    MASTER_PROMPT = """You are the Chief Proposal Architect for a consulting firm competing for high-stakes enterprise deals.

Your role is to establish the NARRATIVE FOUNDATION that will guide the entire proposal. Every section writer will reference your output.

## Input Context:
{input_context}

## Your Task

Analyze the RFP/project context and extract:

1. **Core Problem Statement** - What is the client's ACTUAL pain point? Not generic, but specific to THEIR context.

2. **Solution Thesis** - In 1-2 sentences, what is our answer? This must be memorable and specific.

3. **Value Pillars** - Maximum 3 pillars that will recur throughout. These must be:
   - Relevant to this client's specific situation
   - Differentiating vs competitors
   - Provable with evidence

4. **Client Constraints** - What technical, operational, or regulatory constraints must we acknowledge?

5. **Non-Negotiables** - What MUST the solution deliver? What cannot be compromised?

6. **Buyer Mindset** - What is this buyer's decision-making style?
   - Risk-averse or innovation-hungry?
   - Pilot-first or big-bang?
   - Cost-focused or value-focused?

7. **Competitive Positioning** - How should we position against likely competitors?

8. **Tone Directive** - What voice should the proposal take?

## MANDATORY CONSTRAINTS:
- Client name MUST appear in core_problem and solution_thesis
- Value pillars MUST be provable - no "we are best-in-class"
- Each pillar MUST have 2+ specific proof points
- Constraints MUST be acknowledged - these prove understanding
- Forbidden phrases MUST be in the 'avoid' list

## FORBIDDEN PHRASES (Must include in avoid list):
- "comprehensive solution"
- "seamless integration"
- "best-in-class"
- "world-class"
- "cutting-edge"
- "robust platform"
- "industry-leading"
- "holistic approach"
- "digital transformation journey"
- "leverage synergies"

## Output Format
Return a JSON object:
{{
    "core_problem": "Specific problem statement referencing client by name",
    "solution_thesis": "1-2 sentence memorable solution summary mentioning client",
    "value_pillars": [
        {{
            "pillar": "Pillar Name",
            "why_it_matters": "Specific to client",
            "proof_points": ["Evidence 1", "Evidence 2"],
            "rfp_requirement_addressed": "Which RFP requirement this maps to"
        }}
    ],
    "client_constraints": ["Constraint 1", "Constraint 2"],
    "non_negotiables": ["Must-have 1", "Must-have 2"],
    "buyer_mindset": {{
        "risk_appetite": "low|medium|high",
        "decision_style": "pilot-first|phased|big-bang",
        "value_orientation": "cost-focused|value-focused|innovation-focused",
        "evaluation_priorities": ["Priority 1", "Priority 2"]
    }},
    "competitive_positioning": {{
        "our_advantage": "What makes us uniquely suited",
        "against_large_si": "How to position against Accenture/Deloitte types",
        "against_product_vendors": "How to position against product-centric players",
        "ghost_message": "Subtle differentiator to weave throughout"
    }},
    "tone_directive": {{
        "voice": "confident|humble|authoritative|collaborative",
        "style": "consultative|technical|executive|practical",
        "avoid": ["comprehensive solution", "seamless integration", "best-in-class", "world-class", "cutting-edge", "robust platform", "industry-leading"]
    }},
    "client_name": "Extracted client name",
    "project_name": "Extracted project/scope name",
    "narrative_confidence": {{
        "score": 0-100,
        "level": "HIGH|MEDIUM|LOW",
        "rationale": "Why this confidence level",
        "assumptions": ["What was assumed from limited context"],
        "needs_clarification": ["Areas where more info would help"]
    }},
    "validation_passed": true/false,
    "validation_issues": ["Any issues found with the generated narrative"]
}}

## Critical Rules:
1. NEVER be generic. If you find yourself writing "comprehensive solution" - stop and be specific.
2. Reference the client BY NAME in core_problem and solution_thesis.
3. Value pillars must be PROVABLE - connect to our actual capabilities.
4. Constraints must be ACKNOWLEDGED - these become our proof of understanding.
5. Tone must match buyer mindset.
6. Always include forbidden phrases in the 'avoid' list.

Generate the narrative foundation now:"""

    # Fallback narrative for when AI is unavailable
    DEFAULT_NARRATIVE = {
        "core_problem": "Client requires a tailored solution addressing their specific operational challenges",
        "solution_thesis": "We deliver a pragmatic, proven approach focused on sustainable outcomes and measurable value",
        "value_pillars": [
            {
                "pillar": "Proven Delivery Excellence",
                "why_it_matters": "Track record of successful implementations",
                "proof_points": ["On-time delivery history", "Client testimonials", "Methodology maturity"]
            },
            {
                "pillar": "Domain Expertise",
                "why_it_matters": "Deep understanding of industry challenges",
                "proof_points": ["Industry certifications", "Relevant case studies", "Subject matter experts"]
            },
            {
                "pillar": "Partnership Approach", 
                "why_it_matters": "Long-term value creation, not just project delivery",
                "proof_points": ["Knowledge transfer commitment", "Flexible engagement models", "Post-go-live support"]
            }
        ],
        "client_constraints": ["Timeline constraints", "Budget parameters", "Integration requirements"],
        "non_negotiables": ["Quality standards", "Security compliance", "User adoption"],
        "buyer_mindset": {
            "risk_appetite": "medium",
            "decision_style": "phased",
            "value_orientation": "value-focused",
            "evaluation_priorities": ["Technical capability", "Team experience", "Cost effectiveness"]
        },
        "competitive_positioning": {
            "our_advantage": "Right-sized partner with enterprise capability",
            "against_large_si": "More agile, personalized attention, cost-effective",
            "against_product_vendors": "Solution-agnostic, best-fit approach",
            "ghost_message": "Partnership over vendorship"
        },
        "tone_directive": {
            "voice": "confident",
            "style": "consultative",
            "avoid": ["comprehensive solution", "seamless integration", "best-in-class", "robust platform"]
        },
        "client_name": "Client",
        "project_name": "Project"
    }

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='narrative_architect')
        self._cached_narrative = None
        logger.info(f"ProposalNarrativeArchitectAgent initialized with provider: {self.config.provider}")
    
    def build_narrative_context(
        self,
        project_data: Dict[str, Any],
        rfp_content: str = None,
        extracted_questions: List[Dict] = None,
        sections: List[Dict] = None,
        vendor_profile: Dict = None
    ) -> Dict[str, Any]:
        """
        Build the narrative foundation for the entire proposal.
        
        This method should be called ONCE at the start of proposal generation.
        The output should be passed to ALL content-generating agents.
        
        Args:
            project_data: Project information including name, client, description
            rfp_content: Raw RFP document content if available
            extracted_questions: Questions extracted from RFP
            sections: Proposal sections being generated
            vendor_profile: Our company capabilities
            
        Returns:
            Dict with complete narrative context for proposal coherence
        """
        try:
            # Build input context for the architect
            input_context = self._build_input_context(
                project_data, rfp_content, extracted_questions, sections, vendor_profile
            )
            
            # Generate narrative using AI
            prompt = self.MASTER_PROMPT.format(input_context=json.dumps(input_context, indent=2))
            
            logger.info(f"Building narrative context for: {project_data.get('name', 'Unknown')}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.4,  # Lower temperature for consistency
                max_tokens=3000
            )
            
            # Parse response
            narrative = self._parse_response(response_text)
            
            if not narrative or not narrative.get('core_problem'):
                logger.warning("AI returned incomplete narrative, using enriched fallback")
                narrative = self._generate_enriched_fallback(project_data, vendor_profile)
            
            # Validate and enrich
            narrative = self._validate_and_enrich(narrative, project_data)
            
            # Cache for reuse
            self._cached_narrative = narrative
            
            return {
                'success': True,
                'narrative_context': narrative,
                'generated_at': datetime.utcnow().isoformat(),
                'source': 'ai' if narrative.get('_source') != 'fallback' else 'rule_based'
            }
            
        except Exception as e:
            logger.error(f"Narrative context generation error: {str(e)}")
            fallback = self._generate_enriched_fallback(project_data, vendor_profile)
            return {
                'success': True,
                'narrative_context': fallback,
                'generated_at': datetime.utcnow().isoformat(),
                'source': 'fallback',
                'note': 'Using enriched fallback. Configure LLM for full narrative analysis.'
            }
    
    def _build_input_context(
        self,
        project_data: Dict,
        rfp_content: str,
        extracted_questions: List[Dict],
        sections: List[Dict],
        vendor_profile: Dict
    ) -> Dict:
        """Build the input context for narrative generation."""
        context = {
            'project_name': project_data.get('name', 'Untitled'),
            'client_name': project_data.get('client_name', 'Client'),
            'project_description': project_data.get('description', ''),
            'due_date': str(project_data.get('due_date', '')),
        }
        
        # Add RFP content summary if available
        if rfp_content:
            context['rfp_summary'] = rfp_content[:3000]  # First 3000 chars
        
        # Add question themes if available
        if extracted_questions:
            context['question_themes'] = [
                {
                    'section': q.get('section', 'General'),
                    'question': q.get('text', '')[:200]
                }
                for q in extracted_questions[:10]  # Top 10 questions
            ]
        
        # Add section list if available
        if sections:
            context['sections'] = [
                {
                    'title': s.get('title', ''),
                    'type': s.get('type', '')
                }
                for s in sections
            ]
        
        # Add our capabilities if available
        if vendor_profile:
            context['our_capabilities'] = {
                'strengths': vendor_profile.get('key_strengths', [])[:5],
                'experience': vendor_profile.get('years_in_business'),
                'certifications': vendor_profile.get('certifications', [])[:5]
            }
        
        return context
    
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
            
            logger.warning("Could not parse narrative response")
            return {}
    
    def _generate_enriched_fallback(
        self,
        project_data: Dict,
        vendor_profile: Dict = None
    ) -> Dict:
        """Generate enriched fallback using project data."""
        fallback = self.DEFAULT_NARRATIVE.copy()
        fallback['_source'] = 'fallback'
        
        # Enrich with actual project data
        client_name = project_data.get('client_name', 'Client')
        project_name = project_data.get('name', 'Project')
        description = project_data.get('description', '')
        
        fallback['client_name'] = client_name
        fallback['project_name'] = project_name
        
        # Customize core problem with client name
        if description:
            fallback['core_problem'] = f"{client_name} requires {description[:200]}"
        else:
            fallback['core_problem'] = f"{client_name} requires a tailored solution addressing their specific operational challenges"
        
        # Customize solution thesis
        fallback['solution_thesis'] = f"We deliver a pragmatic, proven approach for {client_name} focused on sustainable outcomes and measurable value"
        
        # Enrich with vendor profile if available
        if vendor_profile:
            if vendor_profile.get('key_strengths'):
                fallback['value_pillars'][0]['proof_points'] = vendor_profile['key_strengths'][:3]
            if vendor_profile.get('certifications'):
                fallback['value_pillars'][1]['proof_points'] = vendor_profile['certifications'][:3]
        
        return fallback
    
    def _validate_and_enrich(self, narrative: Dict, project_data: Dict) -> Dict:
        """Validate narrative and enrich with required fields."""
        # Ensure client name is present
        if not narrative.get('client_name'):
            narrative['client_name'] = project_data.get('client_name', 'Client')
        
        if not narrative.get('project_name'):
            narrative['project_name'] = project_data.get('name', 'Project')
        
        # Ensure required fields exist
        required_fields = [
            'core_problem', 'solution_thesis', 'value_pillars',
            'client_constraints', 'tone_directive'
        ]
        
        for field in required_fields:
            if not narrative.get(field):
                narrative[field] = self.DEFAULT_NARRATIVE.get(field, [])
        
        # Validate value pillars (max 3)
        if len(narrative.get('value_pillars', [])) > 3:
            narrative['value_pillars'] = narrative['value_pillars'][:3]
        
        return narrative
    
    def get_cached_narrative(self) -> Optional[Dict]:
        """Return cached narrative if available."""
        return self._cached_narrative
    
    def get_section_guidance(self, section_type: str, narrative_context: Dict = None) -> Dict:
        """
        Get specific guidance for a section based on narrative context.
        
        Args:
            section_type: Type of section (executive_summary, technical_approach, etc.)
            narrative_context: The narrative context (uses cached if not provided)
            
        Returns:
            Dict with section-specific guidance
        """
        narrative = narrative_context or self._cached_narrative or self.DEFAULT_NARRATIVE
        
        section_guidance = {
            'executive_summary': {
                'must_include': [
                    f"Client name: {narrative.get('client_name', 'Client')}",
                    f"Core problem: {narrative.get('core_problem', '')}",
                    f"Solution thesis: {narrative.get('solution_thesis', '')}",
                    "All 3 value pillars",
                    "Clear next step / call to action"
                ],
                'tone': narrative.get('tone_directive', {}).get('voice', 'confident'),
                'avoid': narrative.get('tone_directive', {}).get('avoid', []),
                'length_guide': '1-2 pages'
            },
            'technical_approach': {
                'must_include': [
                    "Reference to client constraints",
                    "Architecture diagram or description",
                    "Specific technologies with rationale",
                    "Risk acknowledgements with mitigations"
                ],
                'constraints_to_address': narrative.get('client_constraints', []),
                'tone': 'technical but accessible',
                'avoid': ['Generic platform descriptions', 'Vendor marketing speak']
            },
            'our_understanding': {
                'must_include': [
                    f"Client name: {narrative.get('client_name', 'Client')} in every paragraph",
                    "Specific problems from RFP",
                    "Our interpretation of requirements",
                    "Acknowledgement of constraints"
                ],
                'buyer_mindset': narrative.get('buyer_mindset', {}),
                'tone': 'empathetic and knowledgeable',
                'avoid': ['Generic statements', 'Wrong client references']
            },
            'pricing': {
                'must_include': [
                    "Value narrative before numbers",
                    "Clear breakdown by phase",
                    "Assumptions explicitly stated",
                    "Optional items for flexibility"
                ],
                'positioning': narrative.get('competitive_positioning', {}),
                'tone': 'transparent and value-focused'
            }
        }
        
        return section_guidance.get(section_type, {
            'must_include': [
                f"Reference to {narrative.get('client_name', 'Client')}",
                "Connection to value pillars"
            ],
            'tone': narrative.get('tone_directive', {}).get('voice', 'professional'),
            'avoid': narrative.get('tone_directive', {}).get('avoid', [])
        })


def get_proposal_narrative_architect(org_id: int = None) -> ProposalNarrativeArchitectAgent:
    """Factory function to get Proposal Narrative Architect Agent."""
    return ProposalNarrativeArchitectAgent(org_id=org_id)
