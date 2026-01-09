"""
Case Study Generator Agent

AI-powered case study generation for RFP proposals.
Creates compelling case studies based on:
- Project context and requirements
- Organization capabilities
- Industry focus
- Successful project examples

Uses configured LLM provider from organization settings.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class CaseStudyGeneratorAgent:
    """
    Agent for generating relevant case studies for RFP proposals.
    
    Features:
    - Generate case studies matching RFP requirements
    - Customize for specific industries
    - Include metrics and outcomes
    - Create compelling narratives
    """
    
    MASTER_PROMPT = """You are a Senior Proposal Writer specializing in creating compelling case studies for enterprise RFP responses.

Your task is to generate relevant case studies that demonstrate capability for the given project requirements.

## Input Data:
{case_study_context}

## Output Format
Generate a JSON response with the following structure:
{{
  "case_studies": [
    {{
      "case_id": "CS-001",
      "title": "Case Study Title",
      "client_type": "[Industry Type] Organization",
      "client_size": "Enterprise (1000+ employees)|Mid-Market (100-1000)|SMB (<100)",
      "challenge": "Brief description of the client's challenge",
      "solution": "How we addressed the challenge",
      "approach": {{
        "methodology": "Agile/Waterfall/Hybrid",
        "phases": ["Phase 1: Discovery", "Phase 2: Design", "Phase 3: Build", "Phase 4: Deploy"],
        "key_decisions": ["Decision that made difference"]
      }},
      "results": [
        {{
          "metric": "Cost Reduction",
          "value": "25%",
          "description": "Reduced operational costs",
          "measurement_method": "How this was measured",
          "timeframe": "Within first 6 months"
        }}
      ],
      "technologies": ["Tech1", "Tech2"],
      "duration": "6 months",
      "team_size": "8 professionals",
      "team_composition": ["1 PM", "4 Developers", "2 QA", "1 Architect"],
      "key_differentiators": ["What made this special"],
      "lessons_learned": ["Key insight from this project"],
      "testimonial": {{
        "quote": "Client testimonial quote",
        "author": "[Role], [Company Type] Client"
      }},
      "verification_status": "ILLUSTRATIVE|FROM_KNOWLEDGE_BASE|VERIFIED",
      "relevance_score": 0.85,
      "relevance_notes": "Why this is relevant to the RFP",
      "rfp_requirements_addressed": ["REQ-1", "REQ-2"]
    }}
  ],
  "summary": {{
    "total_generated": 3,
    "industries_covered": ["Industry1", "Industry2"],
    "key_themes": ["Theme1", "Theme2"],
    "average_relevance_score": 0.80,
    "verification_note": "These case studies are illustrative examples. Verify with actual client references before final submission."
  }},
  "validation": {{
    "all_metrics_realistic": true,
    "industry_match": true,
    "size_match": true,
    "technology_match": true,
    "confidence_level": "HIGH|MEDIUM|LOW",
    "confidence_rationale": "Basis for confidence",
    "disclaimer": "Case studies are illustrative. Actual client references available upon request."
  }}
}}

## MANDATORY CONSTRAINTS (MUST FOLLOW):
1. ALL metrics MUST be realistic and achievable (no "10x" or "90% reduction" claims)
2. Use "[Company Type]" placeholder for client names unless from knowledge base
3. Include realistic project duration for scope described
4. Team composition MUST be realistic for project scope
5. Always include verification_status to flag AI-generated content
6. Map case studies to specific RFP requirements where possible

## REALISTIC METRIC GUIDELINES:
- Cost reduction: 15-35% is realistic, >50% is rare
- Time savings: 20-40% is realistic, >60% is exceptional
- Efficiency gains: 25-45% is realistic
- Error reduction: 50-80% is achievable
- Customer satisfaction: +10-25 NPS is good improvement

## FORBIDDEN PATTERNS:
- Unrealistic metrics ("99% reduction", "10x improvement")
- Generic client names ("ABC Company", "XYZ Corp")
- Vague outcomes ("improved efficiency" without numbers)
- Testimonials that sound fake or promotional
- Duration that is too short for scope

## Guidelines:
- Create realistic, believable case studies
- Focus on outcomes and measurable results
- Match the industry and project type if specified
- Include relevant technologies and methodologies
- Make testimonials authentic and specific
- Ensure case studies align with RFP requirements
- Be honest about verification status

Generate {case_count} case studies now:"""

    # Default case study templates for fallback
    DEFAULT_CASE_STUDIES = [
        {
            'case_id': 'CS-001',
            'title': 'Enterprise Digital Transformation',
            'client_type': 'Large Enterprise',
            'challenge': 'Client needed to modernize legacy systems while maintaining business continuity',
            'solution': 'Phased migration approach with parallel systems and comprehensive testing',
            'results': [
                {'metric': 'System Uptime', 'value': '99.9%', 'description': 'Maintained during transition'},
                {'metric': 'Efficiency Gain', 'value': '40%', 'description': 'Improved operational efficiency'}
            ],
            'technologies': ['Cloud Infrastructure', 'Modern APIs', 'Agile Methodology'],
            'duration': '12 months',
            'team_size': '10 professionals',
            'key_differentiators': ['Zero-downtime migration', 'Knowledge transfer included'],
        },
        {
            'case_id': 'CS-002',
            'title': 'Process Automation & Analytics Platform',
            'client_type': 'Mid-Market Company',
            'challenge': 'Manual processes leading to delays and errors in operations',
            'solution': 'Implemented automation workflows with real-time analytics dashboard',
            'results': [
                {'metric': 'Time Savings', 'value': '60%', 'description': 'Reduction in manual tasks'},
                {'metric': 'Error Rate', 'value': '85% reduction', 'description': 'Improved accuracy'}
            ],
            'technologies': ['Workflow Automation', 'Business Intelligence', 'Integration Platform'],
            'duration': '6 months',
            'team_size': '6 professionals',
            'key_differentiators': ['Rapid implementation', 'User self-service capabilities'],
        },
        {
            'case_id': 'CS-003',
            'title': 'Customer Experience Enhancement',
            'client_type': 'Consumer-Facing Business',
            'challenge': 'Poor customer engagement and low satisfaction scores',
            'solution': 'Omnichannel experience platform with personalization engine',
            'results': [
                {'metric': 'Customer Satisfaction', 'value': '+25 NPS', 'description': 'Net Promoter Score improvement'},
                {'metric': 'Engagement', 'value': '3x increase', 'description': 'Customer interaction rate'}
            ],
            'technologies': ['Customer Platform', 'AI/ML Personalization', 'Mobile-First Design'],
            'duration': '8 months',
            'team_size': '8 professionals',
            'key_differentiators': ['Data-driven personalization', 'Seamless multi-channel experience'],
        }
    ]

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='case_study')
        logger.info(f"CaseStudyGeneratorAgent initialized with provider: {self.config.provider}")
    
    def _get_case_studies_from_kb(
        self,
        industry: str = None,
        project_type: str = None,
        technologies: list = None,
        limit: int = 5
    ) -> list:
        """
        Retrieve real case studies from the knowledge base (database).
        
        Args:
            industry: Target industry to match
            project_type: Type of project to match
            technologies: Technologies to match
            limit: Max case studies to return
            
        Returns:
            List of case studies in LLM-ready format
        """
        try:
            from app.models import CaseStudy
            
            case_studies = CaseStudy.get_relevant_case_studies(
                organization_id=self.org_id,
                industry=industry,
                project_type=project_type,
                technologies=technologies,
                limit=limit
            )
            
            if case_studies:
                logger.info(f"Found {len(case_studies)} real case studies from KB for industry={industry}")
                return [cs.to_context_dict() for cs in case_studies]
            else:
                logger.info(f"No real case studies found in KB for org={self.org_id}")
                return []
                
        except Exception as e:
            logger.warning(f"Could not query case studies from KB: {e}")
            return []
    
    def generate_case_studies(
        self,
        project_data: Dict[str, Any],
        requirements: List[str] = None,
        industry: str = None,
        case_count: int = 3,
        vendor_profile: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Generate case studies for a proposal.
        
        Enhanced flow:
        1. First query REAL case studies from Knowledge Base (database)
        2. If not enough, supplement with LLM-generated case studies
        3. Mark source clearly (FROM_KNOWLEDGE_BASE vs ILLUSTRATIVE)
        
        Args:
            project_data: Project information
            requirements: Key requirements from RFP
            industry: Target industry
            case_count: Number of case studies to generate
            vendor_profile: Vendor capabilities
            
        Returns:
            Dict with case studies (real + generated)
        """
        try:
            all_case_studies = []
            kb_count = 0
            generated_count = 0
            
            # Step 1: Get REAL case studies from Knowledge Base
            kb_case_studies = self._get_case_studies_from_kb(
                industry=industry,
                project_type=project_data.get('type'),
                limit=case_count
            )
            
            if kb_case_studies:
                all_case_studies.extend(kb_case_studies)
                kb_count = len(kb_case_studies)
                logger.info(f"Added {kb_count} real case studies from KB")
            
            # Step 2: If we need more, generate with LLM
            remaining_needed = case_count - len(all_case_studies)
            
            if remaining_needed > 0:
                # Build context including existing KB case studies for reference
                context = self._build_context(
                    project_data, requirements, industry, vendor_profile
                )
                context['existing_case_studies'] = kb_case_studies  # For LLM context
                context['additional_needed'] = remaining_needed
                
                # Generate using AI
                prompt = self.MASTER_PROMPT.format(
                    case_study_context=json.dumps(context, indent=2),
                    case_count=remaining_needed
                )
                
                logger.info(f"Generating {remaining_needed} additional case studies via LLM")
                
                response_text = self.config.generate_content(
                    prompt,
                    temperature=0.7,
                    max_tokens=5000
                )
                
                result = self._parse_response(response_text)
                
                if result and result.get('case_studies'):
                    # Mark as illustrative
                    for cs in result['case_studies']:
                        cs['verification_status'] = 'ILLUSTRATIVE'
                    all_case_studies.extend(result['case_studies'][:remaining_needed])
                    generated_count = min(len(result['case_studies']), remaining_needed)
            
            # Step 3: Fallback to templates if nothing worked
            if not all_case_studies:
                fallback = self._generate_fallback_case_studies(project_data, industry, case_count)
                all_case_studies = fallback.get('case_studies', [])
                generated_count = len(all_case_studies)
            
            return {
                'success': True,
                'case_studies': all_case_studies[:case_count],
                'summary': {
                    'total_generated': len(all_case_studies[:case_count]),
                    'from_knowledge_base': kb_count,
                    'ai_generated': generated_count,
                    'industries_covered': list(set([cs.get('client_type', industry) for cs in all_case_studies])),
                    'verification_note': f'{kb_count} verified case studies from KB, {generated_count} illustrative examples.'
                },
                'case_count': len(all_case_studies[:case_count]),
                'kb_case_studies': kb_count,
                'generated_case_studies': generated_count,
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Case study generation error: {str(e)}")
            fallback = self._generate_fallback_case_studies(project_data, industry, case_count)
            return {
                'success': True,
                'case_studies': fallback.get('case_studies', []),
                'summary': fallback.get('summary', {}),
                'case_count': len(fallback.get('case_studies', [])),
                'kb_case_studies': 0,
                'generated_case_studies': len(fallback.get('case_studies', [])),
                'generated_at': datetime.utcnow().isoformat(),
                'note': 'Generated from templates. Add real case studies to Knowledge Base for better results.'
            }
    
    def _build_context(
        self,
        project_data: Dict,
        requirements: List[str],
        industry: str,
        vendor_profile: Dict
    ) -> Dict:
        """Build context for the case study generation prompt."""
        return {
            'project_name': project_data.get('name', 'Untitled Project'),
            'project_description': project_data.get('description', ''),
            'client_name': project_data.get('client_name', 'Client'),
            'industry': industry or 'General',
            'key_requirements': requirements or [],
            'vendor_capabilities': vendor_profile.get('key_strengths', []) if vendor_profile else [],
            'vendor_certifications': vendor_profile.get('certifications', []) if vendor_profile else [],
        }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract case studies JSON."""
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
            
            logger.warning("Could not parse case study response")
            return {}
    
    def _generate_fallback_case_studies(
        self,
        project_data: Dict,
        industry: str = None,
        case_count: int = 3
    ) -> Dict:
        """Generate fallback case studies from templates."""
        case_studies = []
        
        for i, template in enumerate(self.DEFAULT_CASE_STUDIES[:case_count]):
            case_study = template.copy()
            
            # Customize based on industry if provided
            if industry:
                case_study['client_type'] = f"{industry} Organization"
                case_study['relevance_notes'] = f"Demonstrates experience in {industry} sector"
            
            # Add relevance score
            case_study['relevance_score'] = 0.75 - (i * 0.1)  # Decreasing relevance
            if not case_study.get('relevance_notes'):
                case_study['relevance_notes'] = 'Demonstrates relevant technical and delivery capabilities'
            
            case_studies.append(case_study)
        
        return {
            'case_studies': case_studies,
            'summary': {
                'total_generated': len(case_studies),
                'industries_covered': [industry] if industry else ['General Enterprise'],
                'key_themes': ['Digital Transformation', 'Process Improvement', 'Customer Experience'],
                'note': 'Generated from templates. Configure AI provider for customized case studies.'
            }
        }


def get_case_study_agent(org_id: int = None) -> CaseStudyGeneratorAgent:
    """Factory function to get Case Study Generator Agent."""
    return CaseStudyGeneratorAgent(org_id=org_id)
