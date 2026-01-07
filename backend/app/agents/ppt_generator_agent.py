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
    
    MASTER_PROMPT = """You are a **SENIOR ENTERPRISE PROPOSAL DESIGNER** creating client-ready, boardroom-quality PPT.

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
      "notes": "Speaker notes with transition"
    }}
  ]
}}

## SLIDE TYPES (Use EXACTLY these)
- cover: Title slide with proposal name, client, date
- agenda: Table of contents (5-7 items)
- problem: Client challenges and pain points
- solution: Proposed solution overview
- content: Standard content slide
- architecture: Technical architecture (structured layers)
- timeline: Phase-wise milestones
- team: Roles and governance model
- risk: Risks and mitigation strategies
- roi: Value, ROI, and success metrics
- pricing: Investment summary
- closing: Next steps and thank you

## MANDATORY 13-SLIDE NARRATIVE (STRICT ORDER)
1. **Cover** (slide_type: "cover") - Proposal title, client name, date
2. **Agenda** (slide_type: "agenda") - Clean 5-7 item overview
3. **Client Challenges** (slide_type: "problem") - Explicit pain points from RFP
4. **Our Understanding** (slide_type: "content") - Problem restatement in client's terms
5. **Proposed Solution** (slide_type: "solution") - High-level approach with outcomes
6. **Architecture & Design** (slide_type: "architecture") - 4-layer technical structure
7. **Delivery Methodology** (slide_type: "content") - Agile phases, approach
8. **Project Roadmap** (slide_type: "timeline") - Key milestones
9. **Team & Governance** (slide_type: "team") - Roles, escalation, communication
10. **Security & Compliance** (slide_type: "content") - Standards, certifications
11. **Risks & Mitigation** (slide_type: "risk") - Top 3-4 risks with strategies
12. **Value & ROI** (slide_type: "roi") - Quantifiable benefits, success metrics
13. **Next Steps** (slide_type: "closing") - Call to action, contact

## CONTENT QUALITY RULES (CRITICAL)

### BANNED PHRASES (NEVER USE):
- "leveraging", "cutting-edge", "next-generation", "seamlessly"
- "robust solution", "revolutionary", "state-of-the-art"
- "holistic approach", "synergy", "best-in-class"
- "world-class", "game-changing", "paradigm shift"

### REQUIRED CONTENT STYLE:
- Every claim MUST have: Method + Tool + Deliverable + Outcome
- Use CLIENT-SPECIFIC language from RFP data
- NO generic marketing phrases
- Concrete, measurable statements only
- Example: "Reduce hiring time by 40% using AI-powered screening"

### BULLET DISCIPLINE:
- 3-5 bullets per slide ONLY
- MAX 10 words per bullet
- Start with action verbs or results
- No redundant points

## ARCHITECTURE SLIDE FORMAT
For architecture slides, structure bullets as 4 layers:
- "Presentation: [specific components from RFP]"
- "Application: [modules, services]"
- "Integration: [APIs, connectors, external systems]"
- "Data: [database, storage, analytics]"

## RFP ALIGNMENT (CRITICAL)
- Extract actual requirements from proposal data
- Map every slide to RFP sections
- Use terminology from client's RFP document
- Address ALL mandatory requirements

## SPEAKER NOTES (MANDATORY)
Every slide "notes" field MUST include:
- 2-3 key talking points with client value
- Smooth transition phrase to next slide
- Example: "This leads us to how we'll structure the team..."

## QUALITY CHECKLIST (VERIFY BEFORE OUTPUT)
- [ ] Exactly 13 slides in correct order
- [ ] No banned phrases used
- [ ] All bullets ≤ 10 words
- [ ] Architecture has 4 layers
- [ ] Every claim is evidence-based
- [ ] Client name used correctly
- [ ] JSON is valid

## PROPOSAL DATA:
{proposal_data}

Generate the complete 13-slide deck JSON. Return ONLY valid JSON:"""

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
            
            # Post-process slides to enforce constraints
            validated_slides = self._validate_and_fix_slides(result.get('slides', []))
            
            return {
                'success': True,
                'slides': validated_slides,
                'slide_count': len(validated_slides),
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
    
    def _validate_and_fix_slides(self, slides: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Post-process slides to ensure content meets constraints.
        Fixes common issues: long bullets, too many bullets, missing fields.
        
        Args:
            slides: List of slide dictionaries from AI
            
        Returns:
            Validated and fixed slide list
        """
        MAX_BULLETS = 6
        MAX_BULLET_CHARS = 80
        MAX_TITLE_CHARS = 60
        
        fixed_slides = []
        
        for slide in slides:
            fixed = slide.copy()
            
            # Truncate title
            if 'title' in fixed and fixed['title']:
                title = str(fixed['title']).strip()
                if len(title) > MAX_TITLE_CHARS:
                    # Try to break at word boundary
                    truncated = title[:MAX_TITLE_CHARS-3]
                    last_space = truncated.rfind(' ')
                    if last_space > MAX_TITLE_CHARS * 0.6:
                        truncated = truncated[:last_space]
                    fixed['title'] = truncated.rstrip() + '...'
            
            # Fix bullets
            if 'bullets' in fixed and fixed['bullets']:
                bullets = fixed['bullets']
                if not isinstance(bullets, list):
                    bullets = [str(bullets)]
                
                fixed_bullets = []
                for bullet in bullets[:MAX_BULLETS]:
                    bullet_text = str(bullet).strip()
                    # Remove leading bullet markers that AI might add
                    bullet_text = bullet_text.lstrip('•-*→▪►◆').strip()
                    # Remove double spaces
                    bullet_text = ' '.join(bullet_text.split())
                    # Truncate if too long
                    if len(bullet_text) > MAX_BULLET_CHARS:
                        truncated = bullet_text[:MAX_BULLET_CHARS-3]
                        last_space = truncated.rfind(' ')
                        if last_space > MAX_BULLET_CHARS * 0.6:
                            truncated = truncated[:last_space]
                        bullet_text = truncated.rstrip() + '...'
                    
                    if bullet_text:
                        fixed_bullets.append(bullet_text)
                
                fixed['bullets'] = fixed_bullets
            
            # Ensure slide_type exists
            if 'slide_type' not in fixed or not fixed['slide_type']:
                fixed['slide_type'] = 'content'
            
            # Ensure notes exist (for speaker notes)
            if 'notes' not in fixed or not fixed['notes']:
                title = fixed.get('title', 'Slide')
                fixed['notes'] = f"Key points for {title}. Emphasize value and client benefits."
            
            fixed_slides.append(fixed)
        
        logger.info(f"Validated {len(fixed_slides)} slides, enforced content constraints")
        return fixed_slides
    
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
        
        # Add compliance data if available (passed through project_data)
        compliance_items = project_data.get('compliance', [])
        if compliance_items:
            compliant_count = sum(1 for c in compliance_items if c.get('status') == 'compliant')
            partial_count = sum(1 for c in compliance_items if c.get('status') == 'partial')
            non_compliant_count = sum(1 for c in compliance_items if c.get('status') == 'non_compliant')
            
            data['compliance_summary'] = {
                'total_requirements': len(compliance_items),
                'compliant': compliant_count,
                'partial': partial_count,
                'non_compliant': non_compliant_count,
                'compliance_rate': round(compliant_count / len(compliance_items) * 100, 1) if compliance_items else 0,
            }
            # Include top requirements for context
            data['key_compliance_items'] = [
                {'requirement': c.get('requirement', ''), 'status': c.get('status', '')}
                for c in compliance_items[:10]
            ]
        
        # Add strategy data if available (passed through project_data)
        strategy = project_data.get('strategy')
        if strategy:
            # Win themes for value proposition and differentiators
            if strategy.get('win_themes'):
                win_themes_data = strategy['win_themes']
                themes = win_themes_data.get('win_themes', [])
                data['win_themes'] = [
                    {
                        'title': t.get('theme_title', ''),
                        'statement': t.get('theme_statement', ''),
                        'benefit': t.get('customer_benefit', ''),
                        'priority': t.get('priority', ''),
                    }
                    for t in themes[:5]  # Top 5 themes
                ]
                data['differentiators'] = win_themes_data.get('differentiators', [])[:5]
            
            # Pricing for investment slide
            if strategy.get('pricing'):
                pricing_data = strategy['pricing']
                pricing_summary = pricing_data.get('pricing_summary', {})
                data['pricing'] = {
                    'total_cost': pricing_summary.get('total_cost', 0),
                    'currency': pricing_summary.get('currency_symbol', '$'),
                    'validity': pricing_summary.get('validity_period', ''),
                }
                effort_breakdown = pricing_data.get('effort_breakdown', [])
                data['effort_breakdown'] = [
                    {'phase': p.get('phase', ''), 'cost': p.get('phase_total', 0)}
                    for p in effort_breakdown
                ]
            
            # Legal review for risks slide
            if strategy.get('legal_review'):
                legal_data = strategy['legal_review']
                data['risk_assessment'] = {
                    'overall_level': legal_data.get('overall_risk_level', ''),
                    'summary': legal_data.get('review_summary', ''),
                }
                risk_items = legal_data.get('risk_items', [])
                data['key_risks'] = [
                    {'severity': r.get('severity', ''), 'description': r.get('description', '')}
                    for r in risk_items[:5]  # Top 5 risks
                ]
        
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
