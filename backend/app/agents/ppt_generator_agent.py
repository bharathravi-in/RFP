"""
PPT Generator Agent - AI-powered PowerPoint presentation generation
Generates professional proposal presentations from RFP data

Uses configured LLM provider (LiteLLM/Google/OpenAI) from organization settings.
"""
import os
import json
import logging
from typing import Dict, List, Any, Optional

from .config import AgentConfig

logger = logging.getLogger(__name__)


class PPTGeneratorAgent:
    """Agent for generating PowerPoint presentation content from proposal data."""
    
    MASTER_PROMPT = """You are a **STRICT ENTERPRISE PPT COMPLIANCE AGENT**.

Your responsibility is **DESIGN + QUALITY COMPLIANCE** for client-ready proposal presentations.

## OUTPUT FORMAT (JSON - MANDATORY)
Generate a JSON response with this EXACT structure:
{{
  "slides": [
    {{
      "slide_number": 1,
      "slide_type": "cover",
      "title": "Slide Title",
      "subtitle": "Optional subtitle",
      "bullets": ["Point 1", "Point 2"],
      "notes": "Speaker notes"
    }}
  ]
}}

## SLIDE TYPES
- cover: Title slide with proposal name, client, date
- agenda: Table of contents (5-7 items max)
- content: Standard bullet slide
- architecture: Technical architecture (use structured bullets)
- timeline: Phase-wise milestones
- team: Roles and governance
- pricing: Investment summary
- closing: Thank you / Q&A

## MANDATORY SLIDE ORDER (19 SLIDES)
1. **Cover** - Proposal title, client name, date
2. **Agenda** - Clean overview of sections
3. **Client Context** - Business challenges
4. **Our Understanding** - Problem restatement
5. **Solution Overview** - High-level approach
6. **Architecture** - Components as structured bullets
7. **Scope of Work** - In/out of scope
8. **Implementation Approach** - Phases, methodology
9. **Timeline** - Phase milestones
10. **Team & Governance** - Roles, communication
11. **Security & Compliance** - Standards addressed
12. **Risks & Mitigation** - Key risks with strategies
13. **Value Proposition** - ROI, quantifiable benefits
14. **Case Studies** - Past success (if available)
15. **Pricing Summary** - Investment breakdown
16. **Assumptions** - Client dependencies
17. **Why Choose Us** - Key differentiators
18. **Next Steps** - Path forward
19. **Thank You** - Contact details

## CONTENT DISCIPLINE (STRICT)

### Each Slide MUST Have:
- **ONE insight-driven title** (not section name)
- **3-5 bullets ONLY**
- Each bullet: **MAX 12 words**

### BANNED PHRASES (NEVER USE):
- "leveraging"
- "cutting-edge"
- "next-generation"
- "seamlessly"
- "robust solution"
- "revolutionary"
- "state-of-the-art"
- "holistic approach"
- "synergy"

### Content Quality:
- Business outcome focused
- Formal enterprise language
- No marketing fluff
- No AI-generated buzzwords

## ARCHITECTURE SLIDE RULES
Architecture slides MUST use structured bullets:
- "User Layer: Web portal, mobile app, admin console"
- "Application: Core modules, business logic"
- "Services: REST APIs, authentication, notifications"
- "Data: Database, document storage, integrations"

## BRAND SAFETY
- Organization name MUST be consistent everywhere
- Do NOT invent brand names
- Do NOT mix client/vendor identities

## SPEAKER NOTES (MANDATORY)
Every slide "notes" field MUST include:
- 2-3 key talking points
- Transition phrase to next slide

## PRE-OUTPUT AUDIT (MANDATORY)
Before output, verify:
- All bullets ≤ 12 words
- No banned phrases used
- Content matches slide title
- 19 slides generated
- JSON is valid

## PROPOSAL DATA:
{proposal_data}

Generate the complete slide deck JSON now. Return ONLY valid JSON:"""

    STYLE_PROMPTS = {
        'modern': "Use modern, clean design language with bold headlines and minimal text.",
        'minimal': "Keep slides extremely minimal with lots of white space and single key messages.",
        'corporate': "Use traditional corporate presentation style with structured layouts.",
        'startup': "Use energetic, dynamic language with focus on innovation and disruption."
    }

    # Comprehensive slide layout definitions
    SLIDE_LAYOUTS = {
        'title': {
            'name': 'Title Slide',
            'description': 'Opening slide with proposal title and client name',
            'placeholders': ['title', 'subtitle', 'date', 'logo'],
            'layout_index': 0
        },
        'title_content': {
            'name': 'Title and Content',
            'description': 'Standard slide with title and bullet points',
            'placeholders': ['title', 'bullets'],
            'layout_index': 1
        },
        'section_header': {
            'name': 'Section Header',
            'description': 'Section divider with section title',
            'placeholders': ['title', 'subtitle'],
            'layout_index': 2
        },
        'two_column': {
            'name': 'Two Column',
            'description': 'Side-by-side comparison layout',
            'placeholders': ['title', 'left_content', 'right_content'],
            'layout_index': 3
        },
        'comparison': {
            'name': 'Comparison',
            'description': 'Before/after or option comparison',
            'placeholders': ['title', 'item1_title', 'item1_content', 'item2_title', 'item2_content'],
            'layout_index': 4
        },
        'content_with_caption': {
            'name': 'Content with Caption',
            'description': 'Visual with explanatory caption',
            'placeholders': ['title', 'content', 'caption'],
            'layout_index': 5
        },
        'picture_with_caption': {
            'name': 'Picture with Caption',
            'description': 'Image-focused slide with text overlay',
            'placeholders': ['title', 'image_placeholder', 'caption'],
            'layout_index': 6
        },
        'blank': {
            'name': 'Blank',
            'description': 'Empty slide for custom content',
            'placeholders': [],
            'layout_index': 7
        },
        'quote': {
            'name': 'Quote',
            'description': 'Client testimonial or key quote',
            'placeholders': ['quote_text', 'attribution'],
            'layout_index': 8
        },
        'metrics': {
            'name': 'Key Metrics',
            'description': 'Dashboard-style metrics display',
            'placeholders': ['title', 'metric1', 'metric2', 'metric3', 'metric4'],
            'layout_index': 9
        },
        'timeline_slide': {
            'name': 'Timeline',
            'description': 'Project phases and milestones',
            'placeholders': ['title', 'phases'],
            'layout_index': 10
        },
        'team_grid': {
            'name': 'Team Grid',
            'description': 'Team member photos and roles',
            'placeholders': ['title', 'team_members'],
            'layout_index': 11
        }
    }

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        # Use AgentConfig for proper LiteLLM/provider support
        self.config = AgentConfig(org_id=org_id, agent_type='ppt_generator')
        logger.info(f"PPT Generator initialized with provider: {self.config.provider}, model: {self.config.model_name}")
    
    def generate_ppt_content(
        self,
        project_data: Dict[str, Any],
        sections: List[Dict[str, Any]],
        questions: List[Dict[str, Any]] = None,
        vendor_profile: Dict[str, Any] = None,
        style: str = 'corporate',
        branding: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Generate PPT slide content from proposal data.
        
        Args:
            project_data: Project information (name, client, dates, etc.)
            sections: List of proposal sections with content
            questions: Optional list of Q&A items
            vendor_profile: Optional vendor/company profile data
            style: Presentation style (modern, minimal, corporate, startup)
            branding: Optional branding guidelines
            
        Returns:
            Dict with slides array and metadata
        """
        try:
            # Build comprehensive proposal data for the prompt
            proposal_data = self._build_proposal_data(
                project_data, sections, questions, vendor_profile
            )
            
            # Add style instructions
            style_instruction = self.STYLE_PROMPTS.get(style, self.STYLE_PROMPTS['corporate'])
            
            # Build the prompt
            prompt = self.MASTER_PROMPT.format(proposal_data=json.dumps(proposal_data, indent=2))
            prompt += f"\n\nStyle: {style_instruction}"
            
            if branding:
                prompt += f"\n\nBranding Guidelines: {json.dumps(branding)}"
            
            logger.info(f"Generating PPT content for project: {project_data.get('name', 'Unknown')}")
            logger.info(f"Using provider: {self.config.provider}, model: {self.config.model_name}")
            
            # Generate using configured provider (LiteLLM, Google, etc.)
            response_text = self.config.generate_content(
                prompt,
                temperature=0.7,
                max_tokens=8000
            )
            
            # Parse the response
            result = self._parse_response(response_text)
            
            return {
                'success': True,
                'slides': result.get('slides', []),
                'slide_count': len(result.get('slides', [])),
                'style': style,
                'provider': self.config.provider,
                'model': self.config.model_name,
            }
            
        except Exception as e:
            logger.error(f"PPT generation error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'slides': [],
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
            'deadline': project_data.get('due_date', ''),
            'created_date': project_data.get('created_at', ''),
        }
        
        # Extract section content by type
        sections_by_type = {}
        for section in sections:
            section_type = section.get('section_type', {})
            slug = section_type.get('slug', 'custom') if isinstance(section_type, dict) else 'custom'
            sections_by_type[slug] = {
                'title': section.get('title', ''),
                'content': section.get('content', ''),
            }
        
        data['sections'] = sections_by_type
        
        # Map sections to PPT fields
        if 'executive_summary' in sections_by_type:
            data['proposal_summary'] = sections_by_type['executive_summary'].get('content', '')
        
        if 'technical_approach' in sections_by_type:
            data['technical_architecture'] = sections_by_type['technical_approach'].get('content', '')
        
        if 'project_estimation' in sections_by_type:
            data['timeline'] = sections_by_type['project_estimation'].get('content', '')
        
        if 'resource_allocation' in sections_by_type:
            data['team_structure'] = sections_by_type['resource_allocation'].get('content', '')
        
        if 'case_studies' in sections_by_type:
            data['case_studies'] = sections_by_type['case_studies'].get('content', '')
        
        if 'company_profile' in sections_by_type:
            data['company_profile'] = sections_by_type['company_profile'].get('content', '')
        
        if 'company_strengths' in sections_by_type:
            data['value_proposition'] = sections_by_type['company_strengths'].get('content', '')
        
        # Add vendor profile if available
        if vendor_profile:
            data['vendor'] = {
                'company_name': vendor_profile.get('company_name', ''),
                'certifications': vendor_profile.get('certifications', []),
                'industries': vendor_profile.get('industries', []),
            }
        
        # Add Q&A summary if available
        if questions:
            answered = [q for q in questions if q.get('status') in ['answered', 'approved']]
            data['qa_count'] = len(answered)
            data['total_questions'] = len(questions)
        
        return data
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse AI response to extract slide JSON using regex."""
        import re
        
        try:
            text = response_text.strip()
            
            # Try to find JSON block using regex
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                text = json_match.group(0)
            
            # Parse JSON
            result = json.loads(text)
            
            # Validate structure
            if 'slides' not in result:
                if isinstance(result, list):
                    result = {'slides': result}
                else:
                    # Check if 'slides' is nested under another key like 'presentation'
                    found_slides = False
                    for key, value in result.items():
                        if isinstance(value, list) and len(value) > 0 and 'slide_type' in value[0]:
                            result = {'slides': value}
                            found_slides = True
                            break
                    
                    if not found_slides:
                        result = {'slides': []}
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse PPT JSON: {e}")
            logger.error(f"Raw response text: {response_text[:500]}...")
            
            # Attempt to sanitize common syntax errors
            try:
                # Sometimes models use single quotes instead of double
                text = text.replace("'", '"')
                return json.loads(text)
            except:
                pass

            return {
                'slides': [
                    {
                        'slide_number': 1,
                        'slide_type': 'cover',
                        'title': 'Error Generating Content',
                        'bullets': ['Please try regenerating the presentation.'],
                        'notes': f"Parsing error: {str(e)}"
                    }
                ]
            }
    
    def generate_single_slide(
        self,
        slide_type: str,
        context: str,
        style: str = 'corporate'
    ) -> Dict[str, Any]:
        """Generate content for a single slide."""
        prompt = f"""Generate a single PowerPoint slide of type '{slide_type}'.
        
Context: {context}
Style: {self.STYLE_PROMPTS.get(style, '')}

Return JSON:
{{
  "title": "Slide Title",
  "bullets": ["Point 1", "Point 2", "Point 3"],
  "visual_suggestion": "Suggested visual element",
  "notes": "Speaker notes"
}}"""
        
        try:
            response_text = self.config.generate_content(prompt)
            return self._parse_response(response_text)
        except Exception as e:
            logger.error(f"Single slide generation error: {e}")
            return {'title': slide_type.title(), 'bullets': []}


def get_ppt_generator_agent(org_id: int = None) -> PPTGeneratorAgent:
    """Factory function to get PPT Generator Agent."""
    return PPTGeneratorAgent(org_id=org_id)
