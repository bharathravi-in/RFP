"""
RFP Analysis Agent Service

AI-powered analysis of RFP documents to:
1. Extract questions and requirements
2. Identify document structure and themes
3. Suggest optimal proposal sections
4. Auto-create proposal sections in the builder
"""
import logging
import json
import re
from typing import Dict, List, Optional
from flask import current_app

import google.generativeai as genai

from app import db
from app.models import (
    Document, Project, Question, RFPSection, RFPSectionType,
    seed_section_types
)

logger = logging.getLogger(__name__)


# Section type slugs mapped to common RFP themes
SECTION_MAPPING = {
    'company': 'company_profile',
    'organization': 'company_profile',
    'about': 'company_profile',
    'background': 'company_profile',
    'experience': 'references',
    'past performance': 'references',
    'references': 'references',
    'case studies': 'references',
    'technical': 'technical_approach',
    'solution': 'technical_approach',
    'methodology': 'technical_approach',
    'approach': 'technical_approach',
    'implementation': 'implementation_plan',
    'timeline': 'implementation_plan',
    'schedule': 'implementation_plan',
    'project plan': 'implementation_plan',
    'pricing': 'pricing_cost',
    'cost': 'pricing_cost',
    'fees': 'pricing_cost',
    'budget': 'pricing_cost',
    'security': 'security_compliance',
    'compliance': 'security_compliance',
    'privacy': 'security_compliance',
    'data protection': 'security_compliance',
    'support': 'support_maintenance',
    'maintenance': 'support_maintenance',
    'service level': 'support_maintenance',
    'sla': 'support_maintenance',
    'team': 'team_qualifications',
    'staff': 'team_qualifications',
    'qualifications': 'team_qualifications',
    'personnel': 'team_qualifications',
    'questions': 'qa_questionnaire',
    'questionnaire': 'qa_questionnaire',
    'q&a': 'qa_questionnaire',
}


class RFPAnalysisAgent:
    """
    AI Agent that analyzes RFP documents to extract structure,
    questions, and suggest optimal proposal sections.
    """
    
    def __init__(self, org_id: int = None):
        """Initialize the agent with AI model."""
        self.org_id = org_id
        self._provider = None
        self._legacy_model = None
        
        # Check for legacy Google API key
        self.ai_enabled = bool(current_app.config.get('GOOGLE_API_KEY')) or (org_id is not None)
    
    def _get_provider(self):
        """Get the LLM provider from database configuration (always reload)."""
        if self.org_id:
            try:
                from app.services.llm_service_helper import get_llm_provider
                self._provider = get_llm_provider(self.org_id, 'rfp_analysis')
            except Exception as e:
                logger.warning(f"Could not get dynamic provider: {e}")
                self._provider = None
        return self._provider
    
    def _get_legacy_model(self):
        """Fallback to legacy Google AI model."""
        if self._legacy_model is None and current_app.config.get('GOOGLE_API_KEY'):
            import google.generativeai as genai
            genai.configure(api_key=current_app.config['GOOGLE_API_KEY'])
            self._legacy_model = genai.GenerativeModel(
                current_app.config.get('GOOGLE_MODEL', 'gemini-1.5-flash')
            )
        return self._legacy_model
    
    def _generate(self, prompt: str) -> str:
        """Generate content using configured provider."""
        # Try dynamic provider first
        provider = self._get_provider()
        if provider:
            try:
                return provider.generate_content(prompt)
            except Exception as e:
                logger.warning(f"Dynamic provider failed: {e}")
        
        # Fallback to legacy
        model = self._get_legacy_model()
        if model:
            response = model.generate_content(prompt)
            return response.text
        
        raise RuntimeError("No AI provider available")
    
    def analyze_rfp(self, document_id: int) -> Dict:
        """
        Main entry point: Analyze an RFP document.
        
        Uses RFPSectionAlignmentAgent for comprehensive question-to-section mapping.
        
        Returns:
            Dict with structure, questions, themes, suggested sections, and section_mappings
        """
        document = Document.query.get(document_id)
        if not document:
            return {'error': 'Document not found'}
        
        if not document.extracted_text:
            return {'error': 'Document has no extracted text. Parse it first.'}
        
        text = document.extracted_text
        
        # Run AI analysis for themes and structure
        analysis = self._analyze_with_ai(text)
        
        # Map to proposal sections (legacy)
        suggested_sections = self._map_to_proposal_sections(analysis)
        
        # NEW: Use RFPSectionAlignmentFixerAgent for comprehensive section mapping
        section_mappings = []
        alignment_summary = None
        try:
            from app.agents import get_rfp_alignment_fixer
            
            # Get project's questions
            questions = Question.query.filter_by(project_id=document.project_id).all()
            extracted_questions = [q.to_dict() for q in questions] if questions else []
            
            # Get KB context for section taxonomy
            kb_context = []
            try:
                from app.services.qdrant_service import get_qdrant_service
                project = document.project
                if project and project.organization_id:
                    qdrant = get_qdrant_service(project.organization_id)
                    kb_context = qdrant.search(
                        query="proposal sections template structure",
                        org_id=project.organization_id,
                        limit=5
                    )
            except Exception as e:
                logger.warning(f"Could not retrieve KB context: {e}")
            
            # Run alignment fixer
            alignment_fixer = get_rfp_alignment_fixer(self.org_id)
            alignment_result = alignment_fixer.analyze_and_fix_alignment(
                rfp_text=text,
                extracted_questions=extracted_questions,
                kb_context=kb_context
            )
            
            section_mappings = alignment_result.get('section_mappings', [])
            alignment_summary = alignment_result.get('alignment_summary', {})
            
            # Build suggested_sections from alignment fixer's master taxonomy
            if section_mappings:
                suggested_sections = self._build_sections_from_alignment_fixer(section_mappings)
            
        except Exception as e:
            logger.warning(f"Section alignment fixer failed: {e}")

        
        return {
            'document_id': document_id,
            'document_name': document.original_filename,
            'analysis': analysis,
            'suggested_sections': suggested_sections,
            'section_mappings': section_mappings,

            'alignment_summary': alignment_summary,
            'questions_extracted': len(document.questions) if document.questions else 0,
        }
    
    def _build_sections_from_alignment(self, section_mappings: List[Dict]) -> List[Dict]:
        """Convert alignment mappings to suggested_sections format."""
        section_types = {st.slug: st for st in RFPSectionType.query.filter_by(is_active=True).all()}
        result = []
        
        for mapping in section_mappings:
            section_id = mapping.get('section_id', '')
            questions = mapping.get('questions', [])
            
            # Try to find matching section type
            st = section_types.get(section_id)
            if st:
                result.append({
                    'section_type_id': st.id,
                    'section_type_slug': st.slug,
                    'section_type_name': st.name,
                    'icon': st.icon,
                    'reason': f"Maps {len(questions)} RFP questions" if questions else "Standard proposal section",
                    'selected': len(questions) > 0,
                    'questions_count': len(questions),
                    'is_narrative_only': mapping.get('is_narrative_only', False)
                })
            else:
                # Custom section not in DB
                result.append({
                    'section_type_id': None,
                    'section_type_slug': section_id,
                    'section_type_name': mapping.get('section_name', section_id.replace('_', ' ').title()),
                    'icon': '📄',
                    'reason': f"Maps {len(questions)} RFP questions" if questions else "Standard proposal section",
                    'selected': len(questions) > 0,
                    'questions_count': len(questions),
                    'is_narrative_only': mapping.get('is_narrative_only', False)
                })
        
        return result

    def _enhance_sections_with_alignment(
        self, 
        suggested_sections: List[Dict], 
        section_mappings: List[Dict]
    ) -> List[Dict]:
        """
        Enhance existing suggested_sections with question counts from alignment.
        PRESERVES original sections - only adds questions_count and is_narrative_only.
        """
        # Build lookup from alignment mappings
        alignment_lookup = {}
        for mapping in section_mappings:
            section_id = mapping.get('section_id', '')
            questions = mapping.get('questions', [])
            alignment_lookup[section_id] = {
                'questions_count': len(questions),
                'is_narrative_only': mapping.get('is_narrative_only', False)
            }
        
        # Enhance each suggested section
        for section in suggested_sections:
            slug = section.get('section_type_slug', '')
            
            # Try to find matching alignment
            if slug in alignment_lookup:
                section['questions_count'] = alignment_lookup[slug]['questions_count']
                section['is_narrative_only'] = alignment_lookup[slug]['is_narrative_only']
                if alignment_lookup[slug]['questions_count'] > 0:
                    section['reason'] = f"Maps {alignment_lookup[slug]['questions_count']} RFP questions"
            else:
                # No alignment data - keep original but mark as no questions
                section['questions_count'] = 0
                section['is_narrative_only'] = True
        
        return suggested_sections

    def _build_sections_from_alignment_fixer(
        self, 
        section_mappings: List[Dict]
    ) -> List[Dict]:
        """
        Build suggested_sections from alignment fixer's comprehensive section mappings.
        This creates sections from the 18-section master taxonomy.
        """
        # Get section types from database
        section_types = {st.slug: st for st in RFPSectionType.query.filter_by(is_active=True).all()}
        
        result = []
        for mapping in section_mappings:
            section_id = mapping.get('section_id', '')
            section_name = mapping.get('section_name', '')
            question_count = mapping.get('question_count', len(mapping.get('questions', [])))
            is_narrative = mapping.get('is_narrative_only', False)
            
            # Try to find matching section type in database
            st = section_types.get(section_id)
            
            if st:
                result.append({
                    'section_type_id': st.id,
                    'section_type_slug': st.slug,
                    'section_type_name': st.name,
                    'icon': st.icon,
                    'reason': f"Maps {question_count} questions" if question_count > 0 else "Standard proposal section",
                    'selected': True,
                    'questions_count': question_count,
                    'is_narrative_only': is_narrative,
                })
            else:
                # Section not in database - create as custom
                result.append({
                    'section_type_id': None,
                    'section_type_slug': section_id,
                    'section_type_name': section_name,
                    'icon': '📄',
                    'reason': f"Maps {question_count} questions" if question_count > 0 else "Standard proposal section",
                    'selected': True,
                    'questions_count': question_count,
                    'is_narrative_only': is_narrative,
                })
        
        return result

    
    def _analyze_with_ai(self, text: str) -> Dict:
        """Use AI to analyze RFP structure and content."""
        if not self.ai_enabled:
            return self._fallback_analysis(text)
        
        prompt = f"""Analyze this RFP/Request for Proposal document and extract the following information:

1. **Sections**: List the main sections in the document with their purpose
2. **Themes**: Key themes or focus areas (e.g., security, scalability, cost)
3. **Requirements**: Critical requirements or must-haves
4. **Evaluation Criteria**: How the proposal will be evaluated (if mentioned)
5. **Deliverables**: What the vendor needs to provide
6. **Timeline**: Any mentioned deadlines or timeline requirements

Return your analysis as a JSON object with this structure:
{{
  "sections": [
    {{"name": "section name", "purpose": "brief description"}}
  ],
  "themes": ["theme1", "theme2"],
  "requirements": ["requirement1", "requirement2"],
  "evaluation_criteria": ["criteria1", "criteria2"],
  "deliverables": ["deliverable1", "deliverable2"],
  "timeline_mentions": ["deadline1", "deadline2"],
  "recommended_proposal_sections": [
    {{"type": "section_type_slug", "reason": "why this section is needed"}}
  ]
}}

RFP Document Text:
{text[:20000]}

Return ONLY the JSON object, no markdown formatting."""

        try:
            response_text = self._generate(prompt).strip()
            
            # Clean markdown code blocks if present
            if response_text.startswith('```'):
                response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            return self._fallback_analysis(text)
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return self._fallback_analysis(text)
    
    def _fallback_analysis(self, text: str) -> Dict:
        """Fallback pattern-based analysis when AI is unavailable."""
        sections = []
        themes = []
        
        # Detect sections via patterns
        section_patterns = [
            r'(?:^|\n)(?:Section|Part|Chapter)\s+[\dIVX]+[:\.\s]+([^\n]+)',
            r'(?:^|\n)([A-Z][A-Z\s]{5,})\s*(?:\n|$)',  # ALL CAPS headers
        ]
        
        for pattern in section_patterns:
            matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
            for match in matches[:10]:  # Limit
                sections.append({
                    'name': match.strip(),
                    'purpose': 'Detected section header'
                })
        
        # Detect themes via keywords
        theme_keywords = {
            'security': ['security', 'secure', 'authentication', 'encryption'],
            'scalability': ['scalability', 'scale', 'growth', 'performance'],
            'compliance': ['compliance', 'regulatory', 'gdpr', 'hipaa'],
            'cost': ['cost', 'pricing', 'budget', 'fee'],
            'experience': ['experience', 'expertise', 'track record'],
            'support': ['support', 'maintenance', 'service level'],
        }
        
        text_lower = text.lower()
        for theme, keywords in theme_keywords.items():
            if any(kw in text_lower for kw in keywords):
                themes.append(theme)
        
        return {
            'sections': sections,
            'themes': themes,
            'requirements': [],
            'evaluation_criteria': [],
            'deliverables': [],
            'timeline_mentions': [],
            'recommended_proposal_sections': [],
        }
    
    def _map_to_proposal_sections(self, analysis: Dict) -> List[Dict]:
        """
        Map RFP analysis to proposal section suggestions.
        ENHANCED: Analyzes requirements and themes to suggest comprehensive sections.
        """
        suggested = []
        added_slugs = set()
        
        # CORE SECTIONS - Always include these for a complete proposal
        core_sections = [
            ('introduction', 'Opening introduction to set context', 1),
            ('executive_summary', 'High-level proposal overview', 1),
            ('our_understanding', 'Understanding of client needs', 2),
            ('company_profile', 'Company background and capabilities', 2),
            ('scope_of_work', 'Detailed work breakdown', 3),
            ('functional_requirements', 'Feature specifications', 3),
            ('technical_approach', 'Technical solution and methodology', 4),
            ('technology_stack', 'Proposed technologies and tools', 4),
            ('implementation_plan', 'Timeline and milestones', 5),
            ('team_qualifications', 'Team structure and expertise', 5),
            ('quality_management', 'QA processes and standards', 6),
            ('risk_management', 'Risk identification and mitigation', 6),
            ('assumptions_dependencies', 'Project assumptions', 7),
            ('pricing_commercial', 'Pricing and commercial terms', 8),
            ('confidentiality', 'NDA and confidentiality terms', 9),
        ]
        
        for slug, reason, priority in core_sections:
            suggested.append({'slug': slug, 'reason': reason, 'priority': priority})
            added_slugs.add(slug)

        
        # CONTENT-BASED DETECTION - Check RFP content for section triggers
        requirements = analysis.get('requirements', [])
        themes = analysis.get('themes', [])
        
        # Build keyword string from all analysis content
        all_content = ' '.join([
            ' '.join(str(r) for r in requirements),
            ' '.join(str(t) for t in themes),
            ' '.join(str(d) for d in analysis.get('deliverables', [])),
            ' '.join(s.get('name', '') for s in analysis.get('sections', []))
        ]).lower()
        
        # Section triggers - if ANY keyword found, add the section
        section_triggers = {
            'security_compliance': {
                'keywords': ['security', 'gdpr', 'hipaa', 'soc', 'encryption', 'authentication', 
                            'data protection', 'privacy', 'compliance', 'iso 27001', 'access control',
                            'password', 'firewall', 'vulnerability', 'penetration test'],
                'reason': 'RFP contains security/compliance requirements',
                'priority': 2
            },
            'implementation_plan': {
                'keywords': ['implementation', 'timeline', 'schedule', 'milestone', 'phase', 
                            'go-live', 'deployment', 'rollout', 'project plan'],
                'reason': 'RFP requires implementation planning',
                'priority': 2
            },
            'pricing_cost': {
                'keywords': ['pricing', 'cost', 'fee', 'budget', 'commercial', 'payment', 
                            'license', 'subscription', 'rate'],
                'reason': 'RFP requests pricing information',
                'priority': 2
            },
            'team_qualifications': {
                'keywords': ['team', 'staff', 'resource', 'personnel', 'experience', 
                            'qualification', 'resume', 'key personnel', 'project manager'],
                'reason': 'RFP requires team information',
                'priority': 3
            },
            'support_maintenance': {
                'keywords': ['support', 'maintenance', 'sla', 'service level', 'helpdesk', 
                            'availability', 'uptime', 'incident', 'ticket'],
                'reason': 'RFP requires support/SLA information',
                'priority': 3
            },
            'references': {
                'keywords': ['reference', 'case study', 'past performance', 'client', 
                            'similar project', 'testimonial'],
                'reason': 'RFP requests references/experience',
                'priority': 3
            },
            'training': {
                'keywords': ['training', 'knowledge transfer', 'documentation', 'manual', 
                            'user guide', 'onboarding'],
                'reason': 'RFP includes training requirements',
                'priority': 4
            },
            'quality_assurance': {
                'keywords': ['quality', 'testing', 'qa', 'test plan', 'acceptance', 
                            'defect', 'bug'],
                'reason': 'RFP includes quality/testing requirements',
                'priority': 4
            },
            'risk_management': {
                'keywords': ['risk', 'mitigation', 'contingency', 'disaster recovery', 
                            'business continuity'],
                'reason': 'RFP mentions risk management',
                'priority': 4
            },
        }
        
        for slug, config in section_triggers.items():
            if slug not in added_slugs:
                if any(kw in all_content for kw in config['keywords']):
                    suggested.append({
                        'slug': slug,
                        'reason': config['reason'],
                        'priority': config['priority']
                    })
                    added_slugs.add(slug)
        
        # Map from themes (legacy support)
        for theme in themes:
            theme_lower = theme.lower()
            for keyword, slug in SECTION_MAPPING.items():
                if keyword in theme_lower and slug not in added_slugs:
                    suggested.append({
                        'slug': slug,
                        'reason': f'Related to theme: {theme}',
                        'priority': 2,
                    })
                    added_slugs.add(slug)
        
        # Map from AI recommendations
        for rec in analysis.get('recommended_proposal_sections', []):
            slug = rec.get('type', '')
            if slug and slug not in added_slugs:
                suggested.append({
                    'slug': slug,
                    'reason': rec.get('reason', 'AI recommended'),
                    'priority': 2,
                })
                added_slugs.add(slug)
        
        # Add Q&A section if document has questions (at the end)
        if 'qa_questionnaire' not in added_slugs:
            suggested.append({
                'slug': 'qa_questionnaire',
                'reason': 'Contains RFP questions requiring responses',
                'priority': 5,
            })
            added_slugs.add('qa_questionnaire')
        
        # Sort by priority
        suggested.sort(key=lambda x: x['priority'])
        
        # Resolve slugs to section types
        section_types = {st.slug: st for st in RFPSectionType.query.filter_by(is_active=True).all()}
        
        result = []
        for s in suggested:
            st = section_types.get(s['slug'])
            if st:
                result.append({
                    'section_type_id': st.id,
                    'section_type_slug': st.slug,

                    'section_type_name': st.name,
                    'icon': st.icon,
                    'reason': s['reason'],
                    'selected': True,  # Default selected
                })
        
        return result
    
    def auto_create_sections(
        self,
        project_id: int,
        section_type_ids: List[int],
        with_generation: bool = True,
        document_id: int = None
    ) -> Dict:
        """
        Create proposal sections in a project and optionally generate content.
        
        Args:
            project_id: Target project ID
            section_type_ids: List of section type IDs to create
            with_generation: Whether to also trigger AI content generation
            document_id: Source document ID for context
            
        Returns:
            Dict with created sections and generation status
        """
        project = Project.query.get(project_id)
        if not project:
            return {'error': 'Project not found'}
        
        # Get document for context
        document = None
        rfp_context = ""
        if document_id:
            document = Document.query.get(document_id)
            if document and document.extracted_text:
                rfp_context = document.extracted_text[:10000]
        
        # If no document provided, find the first one in the project
        if not rfp_context:
            doc = Document.query.filter_by(project_id=project_id, status='completed').first()
            if doc and doc.extracted_text:
                rfp_context = doc.extracted_text[:10000]
        
        # Ensure section types are seeded
        seed_section_types(db.session)
        
        created_sections = []
        
        # Get max order
        max_order = db.session.query(db.func.max(RFPSection.order))\
            .filter_by(project_id=project_id).scalar() or 0
        
        for idx, type_id in enumerate(section_type_ids):
            section_type = RFPSectionType.query.get(type_id)
            if not section_type:
                continue
            
            # Check if section already exists
            existing = RFPSection.query.filter_by(
                project_id=project_id,
                section_type_id=type_id
            ).first()
            
            if existing:
                created_sections.append({
                    'section_id': existing.id,
                    'title': existing.title,
                    'status': 'already_exists',
                })
                continue
            
            # Create new section
            section = RFPSection(
                project_id=project_id,
                section_type_id=type_id,
                title=section_type.name,
                order=max_order + idx + 1,
                status='draft',
                inputs={},
                ai_generation_params={},
            )
            
            db.session.add(section)
            db.session.flush()  # Get ID
            
            section_status = 'created'
            
            # Generate content if requested
            if with_generation and self.ai_enabled:
                try:
                    content_result = self._generate_section_content(
                        section=section,
                        section_type=section_type,
                        project=project,
                        rfp_context=rfp_context
                    )
                    if content_result:
                        section.content = content_result['content']
                        section.confidence_score = content_result.get('confidence', 0.7)
                        section.status = 'generated'
                        section_status = 'generated'
                except Exception as e:
                    logger.error(f"Failed to generate content for {section_type.name}: {e}")
            
            created_sections.append({
                'section_id': section.id,
                'title': section.title,
                'type_slug': section_type.slug,
                'status': section_status,
            })
        
        db.session.commit()
        
        return {
            'project_id': project_id,
            'sections_created': len([s for s in created_sections if s['status'] in ('created', 'generated')]),
            'sections_generated': len([s for s in created_sections if s['status'] == 'generated']),
            'sections': created_sections,
        }
    
    def _generate_section_content(
        self,
        section: RFPSection,
        section_type: RFPSectionType,
        project: Project,
        rfp_context: str
    ) -> Optional[Dict]:
        """
        Generate AI content for a section based on RFP context.
        """
        if not self.ai_enabled:
            return None
        
        # Get knowledge base context
        kb_context = ""
        try:
            from app.services.qdrant_service import QdrantService
            qdrant = QdrantService()
            search_results = qdrant.search(
                query=section_type.name,
                org_id=project.organization_id,
                limit=3
            )
            if search_results:
                kb_context = "\n\n".join([
                    f"Knowledge: {r.get('content', '')[:500]}"
                    for r in search_results
                ])
        except Exception as e:
            logger.warning(f"Knowledge base search failed: {e}")
        
        # Build section-specific prompt
        section_prompts = {
            'executive_summary': """Write a compelling executive summary for this proposal.
Include: key value proposition, understanding of client needs, main solution highlights, and why we're the best choice.
Keep it professional and concise (2-3 paragraphs).""",
            
            'company_profile': """Write a company profile section for this proposal.
Include: company overview, mission/vision, key capabilities, years of experience, and relevant expertise.
Make it professional and confidence-inspiring.""",
            
            'technical_approach': """Write the technical approach section for this proposal.
Include: understanding of requirements, proposed solution architecture, key technologies, 
methodology, and how we'll address the client's technical needs.""",
            
            'implementation_plan': """Write an implementation plan section for this proposal.
Include: project phases, timeline overview, key milestones, deliverables per phase,
and resource allocation. Be realistic but show capability to deliver.""",
            
            'pricing_cost': """Write a pricing and cost section framework for this proposal.
Include: pricing model explanation, value justification, what's included,
and any optional add-ons. Note: Specific pricing to be confirmed with management.""",
            
            'team_qualifications': """Write a team qualifications section for this proposal.
Include: overview of team structure, key roles, experience highlights,
certifications, and why our team is qualified for this project.""",
            
            'references': """Write a references and case studies section for this proposal.
Include: structure for 2-3 relevant case studies, similar projects,
client testimonials template, and measurable outcomes achieved.""",
            
            'security_compliance': """Write a security and compliance section for this proposal.
Include: security measures, data protection practices, compliance certifications,
and how we handle sensitive information.""",
            
            'support_maintenance': """Write a support and maintenance section for this proposal.
Include: support model, SLA overview, maintenance procedures,
communication channels, and ongoing support commitment.""",
            
            'qa_questionnaire': """Write an introduction for the Q&A questionnaire section.
Explain that detailed responses to RFP questions follow, and highlight
our commitment to addressing all requirements thoroughly.""",
        }
        
        base_prompt = section_prompts.get(
            section_type.slug,
            f"Write professional content for the '{section_type.name}' section of this proposal."
        )
        
        prompt = f"""You are writing a proposal response section.

PROJECT: {project.name}
SECTION: {section_type.name}

RFP CONTEXT (from client's RFP document):
{rfp_context[:5000] if rfp_context else "No specific RFP context available."}

COMPANY KNOWLEDGE:
{kb_context if kb_context else "Use general professional language and best practices."}

TASK: {base_prompt}

Write the content now. Be professional, compelling, and specific where possible.
Output only the section content, no headers or labels."""

        try:
            content = self._generate(prompt).strip()
            
            return {
                'content': content,
                'confidence': 0.75,
            }
        except Exception as e:
            logger.error(f"Content generation failed: {e}")
            return None


def get_rfp_analysis_agent() -> RFPAnalysisAgent:
    """Factory function to get an RFP Analysis Agent instance."""
    return RFPAnalysisAgent()

