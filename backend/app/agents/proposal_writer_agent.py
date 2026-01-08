"""
Proposal Writer Agent - Enterprise-grade proposal document generation

Uses a structured master prompt to generate professional, client-ready proposals
following the exact format and quality standards of approved enterprise proposals.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class ProposalWriterAgent:
    """
    Agent for generating structured, enterprise-grade proposal documents.
    
    Follows a strict document structure matching approved proposal standards:
    - Cover Page
    - Revision History
    - Table of Contents
    - Introduction
    - Our Understanding
    - Scope of Work
    - Functional Requirements
    - Implementation Approach
    - Technology Stack
    - Project Plan & Timeline
    - Quality Management
    - Risk Management
    - Documentation
    - Assumptions
    - Confidentiality
    """
    
    # Proposal template library by type
    PROPOSAL_TEMPLATES = {
        'technology_implementation': {
            'name': 'Technology Implementation Proposal',
            'required_sections': ['introduction', 'understanding', 'scope', 'technical_approach', 
                                  'implementation', 'timeline', 'team', 'pricing', 'assumptions'],
            'optional_sections': ['case_studies', 'security', 'training'],
            'emphasis': ['technical_depth', 'methodology', 'risk_mitigation']
        },
        'consulting_services': {
            'name': 'Consulting Services Proposal',
            'required_sections': ['introduction', 'understanding', 'approach', 'deliverables',
                                  'team', 'timeline', 'pricing', 'assumptions'],
            'optional_sections': ['case_studies', 'references'],
            'emphasis': ['expertise', 'past_performance', 'value_proposition']
        },
        'managed_services': {
            'name': 'Managed Services Proposal',
            'required_sections': ['introduction', 'service_description', 'sla', 'governance',
                                  'pricing', 'transition', 'assumptions'],
            'optional_sections': ['security', 'compliance', 'reporting'],
            'emphasis': ['reliability', 'sla_guarantees', 'cost_efficiency']
        },
        'staff_augmentation': {
            'name': 'Staff Augmentation Proposal',
            'required_sections': ['introduction', 'resource_profiles', 'rates', 'terms',
                                  'onboarding', 'governance'],
            'optional_sections': ['case_studies'],
            'emphasis': ['talent_quality', 'flexibility', 'speed']
        }
    }
    
    # Section enhancement types
    ENHANCEMENT_TYPES = {
        'executive': {
            'description': 'Enhance for C-level executives',
            'focus': ['business_outcomes', 'roi', 'strategic_value', 'risk_reduction'],
            'avoid': ['technical_jargon', 'implementation_details'],
            'max_length': 'concise'
        },
        'technical': {
            'description': 'Enhance for technical evaluators',
            'focus': ['architecture', 'integration', 'security', 'scalability'],
            'avoid': ['marketing_language', 'vague_claims'],
            'max_length': 'detailed'
        },
        'financial': {
            'description': 'Enhance for procurement/finance',
            'focus': ['cost_breakdown', 'payment_terms', 'roi', 'assumptions'],
            'avoid': ['technical_complexity'],
            'max_length': 'moderate'
        },
        'compliance': {
            'description': 'Enhance for legal/compliance reviewers',
            'focus': ['certifications', 'data_handling', 'regulatory', 'liability'],
            'avoid': ['ambiguous_language', 'unbounded_commitments'],
            'max_length': 'thorough'
        }
    }
    
    MASTER_PROMPT = """# SYSTEM PROMPT — ENTERPRISE RFP / PROPOSAL DOCUMENT GENERATOR (STRICT MODE)

You are an **Enterprise Proposal Authoring Agent** working on behalf of **{organization_name}**.

Your responsibility is to generate a **client-ready, executive-grade proposal document** that follows strict enterprise documentation standards.

---

## INPUTS PROVIDED

1. **Organization Name**: {organization_name}
2. **Client Name**: {client_name}
3. **Proposal Title**: {proposal_title}
4. **RFP / Requirement Description**: {requirement_description}
5. **Scope Details**: {scope_details}
6. **Timelines**: {timelines}
7. **Knowledge Context**: {knowledge_context}

---

## NON-NEGOTIABLE OUTPUT STRUCTURE  
You MUST generate the proposal with the following sections **in the exact order below**:

### 1. Cover Page
- Client Name  
- Proposal Title  
- Prepared By: {organization_name}
- Approved By  
- Date: {current_date}
- Version Number: 1.0

---

### 2. Revision History  
Professional table with Date | Version | Summary of Changes | Author

---

### 3. Table of Contents  
Auto-numbered, professional formatting

---

### 4. Introduction
- Formal, executive tone
- Business context and background
- Why this engagement is being initiated
- No marketing language

---

### 5. Our Understanding
- Re-articulate the client's requirements in consulting language
- Demonstrate business and operational understanding
- Avoid technical solutioning here

---

### 6. Scope of Work
- Clearly defined **In-Scope activities**
- Written in delivery-oriented language
- Explicit responsibility boundaries

---

### 7. Functional Requirements
MANDATORY FORMAT: **Table**

Columns:
- S.No
- Workflow / Module Name
- Description
- Platform / Tool

Each entry MUST include:
- Trigger conditions
- Approval levels and routing
- Status transitions
- Notification logic
- Data capture and validation rules

---

### 8. Implementation Approach
Describe a **structured, phased delivery methodology**.

#### Mandatory Subsections:
- Discovery & Analysis  
- Design Phase  
- Configuration & Customization  
- Development / Migration  
- Testing (Unit, SIT, UAT)  
- Deployment  
- Hypercare Support  

---

### 9. Technology Stack & Tools Used
- Clearly state client environment
- Tool ownership and responsibility clarity
- No speculative or promotional statements

---

### 10. Project Plan & Timeline
- Phase-based milestones
- High-level timeline
- Clear dependency awareness

---

### 11. Quality Management
- Governance approach
- Review checkpoints
- Acceptance criteria
- Compliance alignment

---

### 12. Risk Management
- Identified risks
- Potential impact
- Mitigation strategy
- Ownership clarity

---

### 13. Documentation
Include:
- Requirement analysis documents
- Technical specifications
- Test cases
- Deployment documentation
- User guides

---

### 14. Assumptions
- Licensing responsibilities
- Access and permissions
- Client dependencies
- Change control expectations

---

### 15. Confidentiality
- Standard enterprise confidentiality clause
- Neutral and professional wording

---

## LANGUAGE & STYLE RULES (STRICT)

✅ Required:
- Formal consulting-grade English
- Long, structured paragraphs
- Neutral, confident delivery tone
- Enterprise vocabulary

❌ Forbidden:
- Marketing buzzwords
- Casual or conversational language
- Short or shallow explanations

---

## OUTPUT FORMAT

Return ONLY the complete proposal document in **Markdown format**.
No explanations, no summaries, no system commentary.

Generate the complete proposal document now:"""

    SECTION_PROMPTS = {
        'cover_page': """Generate a professional cover page for this proposal:
- Client: {client_name}
- Title: {proposal_title}
- Organization: {organization_name}
- Date: {current_date}
- Version: 1.0""",

        'executive_summary': """Write an executive summary for this proposal:
{requirement_description}

Focus on:
- High-level business value
- Key deliverables
- Strategic alignment
- Expected outcomes""",

        'scope_of_work': """Define the scope of work based on:
{requirement_description}

Structure as:
- In-Scope activities (with clear deliverables)
- Out-of-Scope items (explicit boundaries)
- Dependencies and assumptions""",

        'implementation_approach': """Describe the implementation approach:
- Discovery & Analysis phase
- Design phase
- Development/Configuration phase
- Testing phase (Unit, SIT, UAT)
- Deployment phase
- Hypercare Support phase

Make it detailed and professional.""",

        'risk_management': """Create a risk management section including:
- Technical risks
- Resource risks
- Timeline risks
- External dependency risks

For each risk include: Description, Impact, Probability, Mitigation Strategy""",
    }
    
    # NEW: Consulting Artifact Structure - Every section should follow this pattern
    CONSULTING_SECTION_STRUCTURE = {
        'structure': [
            {
                'name': 'Client Reality',
                'description': 'Restate the client\'s actual problem or situation',
                'weight': 0.2
            },
            {
                'name': 'Our Interpretation',
                'description': 'What we understand this means operationally',
                'weight': 0.15
            },
            {
                'name': 'Our Approach',
                'description': 'Specific methodology tailored to this context',
                'weight': 0.35
            },
            {
                'name': 'Why This Works Here',
                'description': 'Evidence specific to client constraints',
                'weight': 0.15
            },
            {
                'name': 'Risks & Ownership',
                'description': 'Explicit risk acknowledgement with mitigation',
                'weight': 0.15
            }
        ],
        'anti_patterns': [
            'comprehensive solution',
            'seamless integration',
            'best-in-class',
            'robust platform',
            'cutting-edge technology',
            'holistic approach',
            'leverage synergies'
        ]
    }
    
    NARRATIVE_SECTION_PROMPT = """# CONSULTING-GRADE SECTION GENERATOR

You are generating a **{section_type}** section for a proposal to **{client_name}**.

## NARRATIVE CONTEXT (Single Source of Truth)
{narrative_context}

## SECTION REQUIREMENTS
{section_requirements}

## MANDATORY STRUCTURE
Every section MUST follow this consulting artifact pattern:

### 1. Client Reality ({client_name}'s Situation)
- Acknowledge the client's actual problem
- Reference specific constraints they face
- Show you understand their context

### 2. Our Interpretation
- What this means operationally
- Hidden implications we've identified
- Why this matters beyond the obvious

### 3. Our Approach for {client_name}
- Specific methodology
- How it's tailored to their constraints
- Clear deliverables

### 4. Why This Works for {client_name}
- Evidence from similar contexts
- Specific proof points
- Architecture, metrics, or case examples

### 5. Risks & Ownership
- Acknowledge realistic risks
- Specific mitigation strategies
- Clear ownership (us vs client)

## ANTI-PATTERNS TO AVOID:
{anti_patterns}

## EVIDENCE REQUIREMENTS:
Every paragraph must include at least one of:
- Specific metric or number
- Architecture or technology reference
- Delivery method or timeline
- Constraint acknowledgement

## TONE: {tone}

Generate the section now in Markdown format. Reference {client_name} by name at least 3 times:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='proposal_writer')
        self._narrative_context = None
        logger.info(f"ProposalWriterAgent initialized with provider: {self.config.provider}")

    def generate_full_proposal(
        self,
        client_name: str,
        proposal_title: str,
        requirement_description: str,
        organization_name: str = None,
        scope_details: str = "",
        timelines: str = "",
        knowledge_context: str = "",
        vendor_profile: Dict = None,
        narrative_context: Dict = None
    ) -> Dict[str, Any]:
        """
        Generate a complete structured proposal document.
        
        Args:
            client_name: Name of the client
            proposal_title: Title of the proposal
            requirement_description: RFP requirements/description
            organization_name: Name of the proposing organization
            scope_details: Additional scope details
            timelines: Timeline information
            knowledge_context: Context from knowledge base
            vendor_profile: Vendor profile data
            narrative_context: Narrative context from ProposalNarrativeArchitectAgent (P0)
            
        Returns:
            Dict with full proposal content and metadata
        """
        try:
            # Store narrative context for section generation
            self._narrative_context = narrative_context
            
            # Build organization name from vendor profile if not provided
            if not organization_name and vendor_profile:
                organization_name = vendor_profile.get('company_name', 'Our Organization')
            organization_name = organization_name or 'Our Organization'
            
            # Override client_name from narrative context if available
            if narrative_context and narrative_context.get('client_name'):
                client_name = narrative_context.get('client_name')
            
            current_date = datetime.now().strftime('%B %d, %Y')
            
            # If we have narrative context, use the enhanced prompt
            if narrative_context:
                return self._generate_with_narrative(
                    client_name=client_name,
                    proposal_title=proposal_title,
                    requirement_description=requirement_description,
                    organization_name=organization_name,
                    scope_details=scope_details,
                    timelines=timelines,
                    knowledge_context=knowledge_context,
                    narrative_context=narrative_context,
                    current_date=current_date
                )
            
            # Fallback to standard generation
            prompt = self.MASTER_PROMPT.format(
                organization_name=organization_name,
                client_name=client_name,
                proposal_title=proposal_title,
                requirement_description=requirement_description,
                scope_details=scope_details or "To be defined based on requirements",
                timelines=timelines or "To be mutually agreed",
                knowledge_context=knowledge_context[:10000] if knowledge_context else "N/A",
                current_date=current_date
            )
            
            logger.info(f"Generating full proposal for: {proposal_title}")
            
            # Generate using configured provider
            response_text = self.config.generate_content(
                prompt,
                temperature=0.7,
                max_tokens=16000  # Large token limit for full proposal
            )
            
            # Parse sections from the generated content
            sections = self._parse_proposal_sections(response_text)
            
            return {
                'success': True,
                'full_content': response_text,
                'sections': sections,
                'metadata': {
                    'client_name': client_name,
                    'proposal_title': proposal_title,
                    'organization_name': organization_name,
                    'generated_at': current_date,
                    'word_count': len(response_text.split()),
                    'provider': self.config.provider,
                    'model': self.config.model_name,
                    'narrative_guided': False
                }
            }
            
        except Exception as e:
            logger.error(f"Proposal generation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'full_content': '',
                'sections': []
            }
    
    def _generate_with_narrative(
        self,
        client_name: str,
        proposal_title: str,
        requirement_description: str,
        organization_name: str,
        scope_details: str,
        timelines: str,
        knowledge_context: str,
        narrative_context: Dict,
        current_date: str
    ) -> Dict[str, Any]:
        """
        Generate proposal guided by narrative context for coherent storyline.
        
        This method uses the narrative context to ensure all sections:
        - Reference the client by name
        - Align with value pillars
        - Acknowledge constraints
        - Maintain consistent tone
        """
        # Build narrative-enhanced prompt
        prompt = f"""# NARRATIVE-GUIDED PROPOSAL GENERATOR

You are generating a proposal for **{client_name}** on behalf of **{organization_name}**.

## NARRATIVE FOUNDATION (Single Source of Truth)
Core Problem: {narrative_context.get('core_problem', 'Not specified')}

Solution Thesis: {narrative_context.get('solution_thesis', 'Not specified')}

Value Pillars:
{self._format_value_pillars(narrative_context.get('value_pillars', []))}

Client Constraints: {', '.join(narrative_context.get('client_constraints', []))}

Non-Negotiables: {', '.join(narrative_context.get('non_negotiables', []))}

Tone: {narrative_context.get('tone_directive', {}).get('voice', 'professional')}, {narrative_context.get('tone_directive', {}).get('style', 'consultative')}

## ANTI-PATTERNS TO AVOID:
{', '.join(narrative_context.get('tone_directive', {}).get('avoid', self.CONSULTING_SECTION_STRUCTURE['anti_patterns']))}

## REQUIREMENTS
{requirement_description}

## SCOPE
{scope_details or "To be defined based on requirements"}

## TIMELINE
{timelines or "To be mutually agreed"}

## KNOWLEDGE CONTEXT
{knowledge_context[:8000] if knowledge_context else "N/A"}

## MANDATORY RULES
1. Reference {client_name} by name in EVERY section (minimum 2x per section)
2. Every section must acknowledge at least one client constraint
3. Every claim must be backed by evidence (metric, architecture, case study)
4. Risks must be explicitly acknowledged with our mitigation ownership
5. Maintain {narrative_context.get('tone_directive', {}).get('voice', 'confident')} tone throughout

## OUTPUT STRUCTURE
Generate a complete proposal with these sections (following consulting artifact pattern):

1. **Cover Page** - {client_name}, {proposal_title}, {organization_name}, {current_date}
2. **Executive Summary** - Solution thesis + value pillars + call to action
3. **Our Understanding** - Client's reality as we interpret it
4. **Our Approach** - Methodology tailored to {client_name}'s constraints
5. **Technical Solution** - Architecture addressing constraints
6. **Implementation Plan** - Phased delivery with milestones
7. **Team & Credentials** - Why we're the safe choice
8. **Risk Management** - Honest risks with ownership
9. **Investment & Timeline** - Value-framed pricing
10. **Next Steps** - Clear path forward

Each section MUST follow this structure:
- Client Reality (their situation)
- Our Interpretation (what this means)
- Our Approach (tailored solution)
- Why This Works Here (evidence)
- Risks & Ownership (honest acknowledgement)

Generate the complete proposal in Markdown format now:"""

        logger.info(f"Generating narrative-guided proposal for: {proposal_title}")
        
        response_text = self.config.generate_content(
            prompt,
            temperature=0.6,  # Slightly lower for consistency
            max_tokens=16000
        )
        
        # Parse sections
        sections = self._parse_proposal_sections(response_text)
        
        # Validate sections for narrative alignment
        validation_results = self._validate_narrative_alignment(sections, narrative_context)
        
        return {
            'success': True,
            'full_content': response_text,
            'sections': sections,
            'metadata': {
                'client_name': client_name,
                'proposal_title': proposal_title,
                'organization_name': organization_name,
                'generated_at': current_date,
                'word_count': len(response_text.split()),
                'provider': self.config.provider,
                'model': self.config.model_name,
                'narrative_guided': True,
                'narrative_context_used': True
            },
            'narrative_validation': validation_results
        }
    
    def _format_value_pillars(self, pillars: List[Dict]) -> str:
        """Format value pillars for prompt."""
        if not pillars:
            return "- No specific value pillars defined"
        
        lines = []
        for i, pillar in enumerate(pillars[:3], 1):
            name = pillar.get('pillar', f'Pillar {i}')
            why = pillar.get('why_it_matters', '')
            proofs = pillar.get('proof_points', [])
            lines.append(f"{i}. **{name}**: {why}")
            if proofs:
                lines.append(f"   - Evidence: {', '.join(proofs[:3])}")
        
        return '\n'.join(lines)
    
    def _validate_narrative_alignment(self, sections: List[Dict], narrative_context: Dict) -> Dict:
        """Validate that sections align with narrative context."""
        client_name = narrative_context.get('client_name', '')
        results = {
            'total_sections': len(sections),
            'sections_with_client_name': 0,
            'sections_with_constraints': 0,
            'anti_patterns_found': [],
            'overall_alignment': 'unknown'
        }
        
        constraints = narrative_context.get('client_constraints', [])
        anti_patterns = narrative_context.get('tone_directive', {}).get('avoid', [])
        
        for section in sections:
            content = section.get('content', '').lower()
            
            # Check client name
            if client_name.lower() in content:
                results['sections_with_client_name'] += 1
            
            # Check constraints
            for constraint in constraints:
                if constraint.lower() in content:
                    results['sections_with_constraints'] += 1
                    break
            
            # Check anti-patterns
            for pattern in anti_patterns:
                if pattern.lower() in content:
                    results['anti_patterns_found'].append({
                        'section': section.get('title', 'Unknown'),
                        'pattern': pattern
                    })
        
        # Calculate alignment score
        if len(sections) > 0:
            client_ratio = results['sections_with_client_name'] / len(sections)
            constraint_ratio = results['sections_with_constraints'] / len(sections)
            anti_pattern_penalty = len(results['anti_patterns_found']) * 0.1
            
            alignment_score = (client_ratio * 0.5 + constraint_ratio * 0.3) - anti_pattern_penalty
            
            if alignment_score >= 0.7:
                results['overall_alignment'] = 'strong'
            elif alignment_score >= 0.4:
                results['overall_alignment'] = 'moderate'
            else:
                results['overall_alignment'] = 'weak'
        
        return results

    def generate_section(
        self,
        section_type: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a single proposal section.
        
        Args:
            section_type: Type of section to generate
            context: Context data for the section
            
        Returns:
            Dict with section content
        """
        if section_type not in self.SECTION_PROMPTS:
            return {
                'success': False,
                'error': f"Unknown section type: {section_type}"
            }
        
        try:
            prompt = self.SECTION_PROMPTS[section_type].format(**context)
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.7,
                max_tokens=4000
            )
            
            return {
                'success': True,
                'section_type': section_type,
                'content': response_text.strip(),
                'word_count': len(response_text.split())
            }
            
        except Exception as e:
            logger.error(f"Section generation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'section_type': section_type
            }

    def _parse_proposal_sections(self, content: str) -> List[Dict]:
        """Parse the generated proposal into individual sections."""
        sections = []
        
        # Define expected sections
        section_headers = [
            ('Cover Page', 'cover_page'),
            ('Revision History', 'revision_history'),
            ('Table of Contents', 'table_of_contents'),
            ('Introduction', 'introduction'),
            ('Our Understanding', 'understanding'),
            ('Scope of Work', 'scope_of_work'),
            ('Functional Requirements', 'functional_requirements'),
            ('Implementation Approach', 'implementation_approach'),
            ('Technology Stack', 'technology_stack'),
            ('Project Plan', 'project_plan'),
            ('Quality Management', 'quality_management'),
            ('Risk Management', 'risk_management'),
            ('Documentation', 'documentation'),
            ('Assumptions', 'assumptions'),
            ('Confidentiality', 'confidentiality'),
        ]
        
        # Split by markdown headers
        lines = content.split('\n')
        current_section = None
        current_content = []
        
        for line in lines:
            # Check if this is a section header
            header_match = re.match(r'^#{1,3}\s+(.+)', line)
            if header_match:
                header_text = header_match.group(1).strip()
                
                # Save previous section
                if current_section:
                    sections.append({
                        'id': current_section['id'],
                        'title': current_section['title'],
                        'content': '\n'.join(current_content).strip()
                    })
                
                # Find matching section type
                section_id = 'custom'
                for name, sid in section_headers:
                    if name.lower() in header_text.lower():
                        section_id = sid
                        break
                
                current_section = {
                    'id': section_id,
                    'title': header_text
                }
                current_content = []
            else:
                current_content.append(line)
        
        # Don't forget the last section
        if current_section:
            sections.append({
                'id': current_section['id'],
                'title': current_section['title'],
                'content': '\n'.join(current_content).strip()
            })
        
        return sections

    def enhance_section(
        self,
        section_content: str,
        enhancement_type: str = 'expand',
        context: Dict = None
    ) -> Dict[str, Any]:
        """
        Enhance an existing section.
        
        Args:
            section_content: Existing content to enhance
            enhancement_type: Type of enhancement (expand, formalize, add_detail)
            context: Additional context
            
        Returns:
            Enhanced content
        """
        enhancement_prompts = {
            'expand': "Expand this section with more detail while maintaining formal consulting tone:",
            'formalize': "Make this section more formal and enterprise-ready:",
            'add_detail': "Add specific implementation details and examples:",
            'add_table': "Convert key information into professional tables where appropriate:",
        }
        
        instruction = enhancement_prompts.get(enhancement_type, enhancement_prompts['expand'])
        
        prompt = f"""{instruction}

{section_content}

{f'Additional Context: {json.dumps(context)}' if context else ''}

Return the enhanced content in markdown format, maintaining enterprise proposal standards."""
        
        try:
            response_text = self.config.generate_content(prompt, temperature=0.7)
            return {
                'success': True,
                'enhanced_content': response_text.strip(),
                'enhancement_type': enhancement_type
            }
        except Exception as e:
            logger.error(f"Section enhancement error: {e}")
            return {
                'success': False,
                'error': str(e),
                'enhanced_content': section_content
            }
    
    def generate_consulting_section(
        self,
        section_type: str,
        narrative_context: Dict[str, Any],
        section_requirements: str = "",
        section_guidance: Dict = None
    ) -> Dict[str, Any]:
        """
        Generate a section using the consulting artifact structure.
        
        This method enforces the 5-part structure:
        1. Client Reality
        2. Our Interpretation
        3. Our Approach
        4. Why This Works Here
        5. Risks & Ownership
        
        Args:
            section_type: Type of section (e.g., 'technical_approach', 'executive_summary')
            narrative_context: Context from ProposalNarrativeArchitectAgent
            section_requirements: Specific requirements for this section
            section_guidance: Guidance from narrative architect's get_section_guidance()
            
        Returns:
            Dict with section content and metadata
        """
        try:
            client_name = narrative_context.get('client_name', 'Client')
            
            # Get tone from narrative context
            tone_directive = narrative_context.get('tone_directive', {})
            tone = f"{tone_directive.get('voice', 'confident')}, {tone_directive.get('style', 'consultative')}"
            
            # Build anti-patterns list
            anti_patterns = self.CONSULTING_SECTION_STRUCTURE['anti_patterns']
            if tone_directive.get('avoid'):
                anti_patterns = list(set(anti_patterns + tone_directive['avoid']))
            
            # Build prompt
            prompt = self.NARRATIVE_SECTION_PROMPT.format(
                section_type=section_type,
                client_name=client_name,
                narrative_context=json.dumps(narrative_context, indent=2)[:3000],
                section_requirements=section_requirements or f"Generate a {section_type} section",
                anti_patterns='\n'.join(f"- {p}" for p in anti_patterns),
                tone=tone
            )
            
            logger.info(f"Generating consulting-grade {section_type} for {client_name}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.6,
                max_tokens=6000
            )
            
            # Validate content has the required structure parts
            content = response_text.strip()
            structure_validation = self._validate_consulting_structure(content, client_name)
            
            return {
                'success': True,
                'section_type': section_type,
                'content': content,
                'word_count': len(content.split()),
                'client_references': content.lower().count(client_name.lower()),
                'structure_validation': structure_validation,
                'follows_consulting_structure': structure_validation.get('all_parts_present', False)
            }
            
        except Exception as e:
            logger.error(f"Consulting section generation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'section_type': section_type,
                'content': ''
            }
    
    def _validate_consulting_structure(self, content: str, client_name: str) -> Dict:
        """Validate that content follows the 5-part consulting structure."""
        content_lower = content.lower()
        
        # Check for structure parts
        parts_found = {
            'client_reality': any(
                phrase in content_lower for phrase in 
                ['reality', 'situation', 'challenge', 'facing', 'current state']
            ),
            'interpretation': any(
                phrase in content_lower for phrase in 
                ['interpret', 'understand', 'means', 'implication', 'our view']
            ),
            'approach': any(
                phrase in content_lower for phrase in 
                ['approach', 'methodology', 'solution', 'how we', 'our approach']
            ),
            'evidence': any(
                phrase in content_lower for phrase in 
                ['because', 'evidence', 'proven', 'similar', 'case', 'metric', '%']
            ),
            'risks': any(
                phrase in content_lower for phrase in 
                ['risk', 'mitigation', 'challenge', 'contingency', 'ownership']
            )
        }
        
        # Check client name usage
        client_count = content_lower.count(client_name.lower())
        
        # Check for anti-patterns
        anti_patterns_found = [
            pattern for pattern in self.CONSULTING_SECTION_STRUCTURE['anti_patterns']
            if pattern.lower() in content_lower
        ]
        
        return {
            'parts_found': parts_found,
            'all_parts_present': all(parts_found.values()),
            'parts_missing': [k for k, v in parts_found.items() if not v],
            'client_name_count': client_count,
            'client_name_sufficient': client_count >= 2,
            'anti_patterns_found': anti_patterns_found,
            'anti_pattern_free': len(anti_patterns_found) == 0
        }


def get_proposal_writer_agent(org_id: int = None) -> ProposalWriterAgent:
    """Factory function to get Proposal Writer Agent."""
    return ProposalWriterAgent(org_id=org_id)
