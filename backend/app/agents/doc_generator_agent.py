"""
DOC Generator Agent - AI-powered DOCX document content generation
Generates professional proposal document content from RFP data

Uses configured LLM provider (LiteLLM/Google/OpenAI) from organization settings.
"""
import json
import logging
from typing import Dict, List, Any, Optional

from .config import AgentConfig

logger = logging.getLogger(__name__)


class DOCGeneratorAgent:
    """Agent for generating DOCX document content from proposal data."""
    
    MASTER_PROMPT = """You are a Senior Enterprise Pre-Sales Consultant and Proposal Architect specializing in RFP responses and professional proposal documents.

Your task is to generate professional, client-ready document section content based on the provided proposal data.

## Output Format
Generate a JSON response with the following structure:
{{
  "sections": [
    {{
      "section_id": "executive_summary",
      "title": "Executive Summary",
      "content": "Full markdown content for this section...",
      "subsections": [
        {{
          "title": "Key Highlights",
          "content": "Subsection content..."
        }}
      ],
      "key_points": ["Point 1", "Point 2"],
      "word_count": 250
    }}
  ],
  "document_metadata": {{
    "total_word_count": 5000,
    "reading_time_minutes": 20,
    "sections_generated": 10
  }}
}}

## Section Types to Generate (in order):
1. **Executive Summary** - High-level overview, value proposition, key differentiators
2. **Understanding of Requirements** - Client challenges, objectives, scope interpretation
3. **Proposed Solution** - Solution architecture, key features, technology stack
4. **Technical Approach** - Methodology, architecture details, integration approach
5. **Implementation Plan** - Phases, milestones, timeline, deliverables
6. **Team & Resources** - Team structure, roles, expertise, governance model
7. **Quality Assurance** - QA methodology, testing approach, quality metrics
8. **Security & Compliance** - Security measures, compliance frameworks, data protection
9. **Risk Management** - Risk identification, mitigation strategies, contingencies
10. **Pricing & Commercial Terms** - Pricing model, payment terms, assumptions
11. **Case Studies & References** - Relevant past projects, client testimonials
12. **Why Choose Us** - Competitive differentiators, unique value, company strengths

## Content Guidelines:
- Write in professional, confident, client-focused tone
- Use bullet points and structured formatting where appropriate
- Include specific details from the provided context
- Aim for 200-400 words per section (adjust based on complexity)
- Use markdown formatting for headers, lists, bold, etc.
- Avoid generic filler content - be specific and substantive
- Replace placeholders with actual data where available

## Proposal Data:
{proposal_data}

## Style Instructions:
{style_instructions}

Generate the complete document sections JSON now:"""

    STYLE_PRESETS = {
        'formal': "Use formal, traditional business language. Avoid contractions. Maintain professional distance.",
        'consultative': "Use consultative language that demonstrates partnership. Balance formality with approachability.",
        'technical': "Include more technical details. Use precise terminology. Assume technical audience.",
        'executive': "Focus on business outcomes and ROI. Keep language concise and impactful.",
        'persuasive': "Use persuasive language. Emphasize benefits and value. Include strong calls to action."
    }

    # Document template configurations for DOCX styling
    DOCUMENT_TEMPLATES = {
        'default': {
            'name': 'Default Template',
            'description': 'Standard professional document template',
            'fonts': {'heading': 'Calibri', 'body': 'Calibri'},
            'colors': {'primary': '2E5A82', 'secondary': '5B8FB9'},
            'margins': {'top': 1.0, 'bottom': 1.0, 'left': 1.0, 'right': 1.0}
        },
        'corporate': {
            'name': 'Corporate Template',
            'description': 'Formal corporate document with conservative styling',
            'fonts': {'heading': 'Times New Roman', 'body': 'Times New Roman'},
            'colors': {'primary': '1F3864', 'secondary': '4472C4'},
            'margins': {'top': 1.0, 'bottom': 1.0, 'left': 1.25, 'right': 1.0}
        },
        'modern': {
            'name': 'Modern Template',
            'description': 'Contemporary design with clean lines',
            'fonts': {'heading': 'Arial', 'body': 'Arial'},
            'colors': {'primary': '2C3E50', 'secondary': '3498DB'},
            'margins': {'top': 0.75, 'bottom': 0.75, 'left': 1.0, 'right': 1.0}
        },
        'executive': {
            'name': 'Executive Template',
            'description': 'Premium executive-level presentation',
            'fonts': {'heading': 'Garamond', 'body': 'Garamond'},
            'colors': {'primary': '2C3E50', 'secondary': '7F8C8D'},
            'margins': {'top': 1.0, 'bottom': 1.0, 'left': 1.25, 'right': 1.25}
        }
    }

    # Section order for TOC generation
    SECTION_ORDER = [
        {'id': 'cover_page', 'title': 'Cover Page', 'level': 0, 'in_toc': False},
        {'id': 'table_of_contents', 'title': 'Table of Contents', 'level': 0, 'in_toc': False},
        {'id': 'executive_summary', 'title': 'Executive Summary', 'level': 1, 'in_toc': True},
        {'id': 'introduction', 'title': 'Introduction', 'level': 1, 'in_toc': True},
        {'id': 'understanding', 'title': 'Understanding of Requirements', 'level': 1, 'in_toc': True},
        {'id': 'proposed_solution', 'title': 'Proposed Solution', 'level': 1, 'in_toc': True},
        {'id': 'technical_approach', 'title': 'Technical Approach', 'level': 1, 'in_toc': True},
        {'id': 'implementation_plan', 'title': 'Implementation Plan', 'level': 1, 'in_toc': True},
        {'id': 'team_resources', 'title': 'Team & Resources', 'level': 1, 'in_toc': True},
        {'id': 'quality_assurance', 'title': 'Quality Assurance', 'level': 1, 'in_toc': True},
        {'id': 'security_compliance', 'title': 'Security & Compliance', 'level': 1, 'in_toc': True},
        {'id': 'risk_management', 'title': 'Risk Management', 'level': 1, 'in_toc': True},
        {'id': 'pricing', 'title': 'Pricing & Commercial Terms', 'level': 1, 'in_toc': True},
        {'id': 'case_studies', 'title': 'Case Studies & References', 'level': 1, 'in_toc': True},
        {'id': 'why_choose_us', 'title': 'Why Choose Us', 'level': 1, 'in_toc': True},
        {'id': 'appendix', 'title': 'Appendix', 'level': 1, 'in_toc': True},
    ]

    # Cover page configuration
    COVER_PAGE_CONFIG = {
        'elements': [
            {'type': 'logo', 'position': 'top-center', 'size': 'medium'},
            {'type': 'title', 'position': 'center', 'font_size': 36},
            {'type': 'subtitle', 'position': 'center', 'font_size': 18},
            {'type': 'client_name', 'position': 'center', 'font_size': 14},
            {'type': 'divider', 'position': 'center', 'style': 'line'},
            {'type': 'prepared_by', 'position': 'bottom', 'font_size': 12},
            {'type': 'date', 'position': 'bottom', 'font_size': 12},
            {'type': 'version', 'position': 'bottom', 'font_size': 10},
        ],
        'default_subtitle': 'Technical & Commercial Proposal',
        'default_version': '1.0'
    }

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        # Use AgentConfig for proper LiteLLM/provider support
        self.config = AgentConfig(org_id=org_id, agent_type='doc_generator')
        logger.info(f"DOC Generator initialized with provider: {self.config.provider}, model: {self.config.model_name}")
    
    def generate_document_content(
        self,
        project_data: Dict[str, Any],
        sections: List[Dict[str, Any]],
        questions: List[Dict[str, Any]] = None,
        vendor_profile: Dict[str, Any] = None,
        style: str = 'consultative',
        section_types: List[str] = None
    ) -> Dict[str, Any]:
        """
        Generate document section content from proposal data.
        
        Args:
            project_data: Project information (name, client, dates, etc.)
            sections: List of existing proposal sections with content
            questions: Optional list of Q&A items
            vendor_profile: Optional vendor/company profile data
            style: Document style (formal, consultative, technical, executive, persuasive)
            section_types: Optional list of specific section types to generate
            
        Returns:
            Dict with sections array and metadata
        """
        try:
            # Build comprehensive proposal data for the prompt
            proposal_data = self._build_proposal_data(
                project_data, sections, questions, vendor_profile
            )
            
            # Get style instructions
            style_instructions = self.STYLE_PRESETS.get(style, self.STYLE_PRESETS['consultative'])
            
            if section_types:
                style_instructions += f"\n\nGenerate only these sections: {', '.join(section_types)}"
            
            # Build the prompt
            prompt = self.MASTER_PROMPT.format(
                proposal_data=json.dumps(proposal_data, indent=2),
                style_instructions=style_instructions
            )
            
            logger.info(f"Generating document content for project: {project_data.get('name', 'Unknown')}")
            logger.info(f"Using provider: {self.config.provider}, model: {self.config.model_name}")
            
            # Generate using configured provider
            response_text = self.config.generate_content(
                prompt,
                temperature=0.7,
                max_tokens=8000
            )
            
            # Parse the response
            result = self._parse_response(response_text)
            
            return {
                'success': True,
                'sections': result.get('sections', []),
                'document_metadata': result.get('document_metadata', {}),
                'section_count': len(result.get('sections', [])),
                'style': style,
                'provider': self.config.provider,
                'model': self.config.model_name,
            }
            
        except Exception as e:
            logger.error(f"Document generation error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'sections': [],
            }
    
    def _build_proposal_data(
        self,
        project_data: Dict[str, Any],
        sections: List[Dict[str, Any]],
        questions: List[Dict[str, Any]] = None,
        vendor_profile: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Build structured proposal data for the AI prompt."""
        
        data = {
            'client_name': project_data.get('client_name', 'Client'),
            'project_name': project_data.get('name', 'Proposal'),
            'industry': project_data.get('industry', ''),
            'geography': project_data.get('geography', ''),
            'deadline': project_data.get('due_date', ''),
            'created_date': project_data.get('created_at', ''),
            'description': project_data.get('description', ''),
        }
        
        # Extract existing section content by type
        sections_by_type = {}
        for section in sections:
            section_type = section.get('section_type', {})
            slug = section_type.get('slug', 'custom') if isinstance(section_type, dict) else 'custom'
            sections_by_type[slug] = {
                'title': section.get('title', ''),
                'content': section.get('content', ''),
                'status': section.get('status', ''),
            }
        
        data['existing_sections'] = sections_by_type
        
        # Add vendor profile if available
        if vendor_profile:
            data['vendor'] = {
                'company_name': vendor_profile.get('company_name', ''),
                'certifications': vendor_profile.get('certifications', []),
                'industries': vendor_profile.get('industries', []),
                'years_in_business': vendor_profile.get('years_in_business', ''),
                'employee_count': vendor_profile.get('employee_count', ''),
                'geographies': vendor_profile.get('geographies', []),
            }
        
        # Add Q&A summary if available
        if questions:
            answered = [q for q in questions if q.get('status') in ['answered', 'approved']]
            data['qa_summary'] = {
                'total_questions': len(questions),
                'answered_count': len(answered),
                'categories': list(set(q.get('category', 'general') for q in questions))
            }
        
        return data
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse AI response to extract document JSON."""
        import re
        
        try:
            text = response_text.strip()
            
            # Try to find JSON block
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                text = json_match.group(0)
            
            # Parse JSON
            result = json.loads(text)
            
            # Validate structure
            if 'sections' not in result:
                if isinstance(result, list):
                    result = {'sections': result}
                else:
                    result = {'sections': []}
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse document JSON: {e}")
            logger.error(f"Raw response text: {response_text[:500]}...")
            
            return {
                'sections': [
                    {
                        'section_id': 'error',
                        'title': 'Generation Error',
                        'content': 'Document content could not be generated. Please try again.',
                        'key_points': [f"Error: {str(e)}"]
                    }
                ]
            }
    
    def generate_single_section(
        self,
        section_type: str,
        context: Dict[str, Any],
        style: str = 'consultative'
    ) -> Dict[str, Any]:
        """Generate content for a single document section."""
        prompt = f"""Generate professional proposal content for a '{section_type}' section.

Context:
{json.dumps(context, indent=2)}

Style: {self.STYLE_PRESETS.get(style, '')}

Return JSON:
{{
  "section_id": "{section_type}",
  "title": "Section Title",
  "content": "Full markdown content...",
  "key_points": ["Point 1", "Point 2"],
  "word_count": 300
}}"""
        
        try:
            response_text = self.config.generate_content(prompt)
            return self._parse_response(response_text)
        except Exception as e:
            logger.error(f"Single section generation error: {e}")
            return {
                'section_id': section_type,
                'title': section_type.replace('_', ' ').title(),
                'content': '',
                'key_points': []
            }
    
    def enhance_section(
        self,
        section_content: str,
        enhancement_type: str = 'expand',
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Enhance existing section content.
        
        Args:
            section_content: Existing section content to enhance
            enhancement_type: Type of enhancement (expand, summarize, formalize, simplify)
            context: Additional context for enhancement
            
        Returns:
            Enhanced content
        """
        enhancement_prompts = {
            'expand': "Expand this content with more detail, examples, and specifics while maintaining the same tone.",
            'summarize': "Summarize this content to be more concise while keeping key points.",
            'formalize': "Make this content more formal and professional.",
            'simplify': "Simplify this content for a non-technical audience.",
        }
        
        instruction = enhancement_prompts.get(enhancement_type, enhancement_prompts['expand'])
        
        prompt = f"""{instruction}

Original Content:
{section_content}

{f'Additional Context: {json.dumps(context)}' if context else ''}

Return the enhanced content in markdown format."""
        
        try:
            response_text = self.config.generate_content(prompt)
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


def get_doc_generator_agent(org_id: int = None) -> DOCGeneratorAgent:
    """Factory function to get DOC Generator Agent."""
    return DOCGeneratorAgent(org_id=org_id)
