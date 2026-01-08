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
      "client_type": "Industry/Type",
      "challenge": "Brief description of the client's challenge",
      "solution": "How we addressed the challenge",
      "results": [
        {{"metric": "Cost Reduction", "value": "30%", "description": "Reduced operational costs"}},
        {{"metric": "Time to Market", "value": "50% faster", "description": "Accelerated delivery"}}
      ],
      "technologies": ["Tech1", "Tech2"],
      "duration": "6 months",
      "team_size": "8 professionals",
      "key_differentiators": ["What made this special"],
      "testimonial": {{
        "quote": "Client testimonial quote",
        "author": "Client Name, Title"
      }},
      "relevance_score": 0.85,
      "relevance_notes": "Why this is relevant to the RFP"
    }}
  ],
  "summary": {{
    "total_generated": 3,
    "industries_covered": ["Industry1", "Industry2"],
    "key_themes": ["Theme1", "Theme2"]
  }}
}}

## Guidelines:
- Create realistic, believable case studies
- Focus on outcomes and measurable results
- Match the industry and project type if specified
- Include relevant technologies and methodologies
- Make testimonials authentic and specific
- Ensure case studies align with RFP requirements

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
        
        Args:
            project_data: Project information
            requirements: Key requirements from RFP
            industry: Target industry
            case_count: Number of case studies to generate
            vendor_profile: Vendor capabilities
            
        Returns:
            Dict with generated case studies
        """
        try:
            # Build context
            context = self._build_context(
                project_data, requirements, industry, vendor_profile
            )
            
            # Generate using AI
            prompt = self.MASTER_PROMPT.format(
                case_study_context=json.dumps(context, indent=2),
                case_count=case_count
            )
            
            logger.info(f"Generating {case_count} case studies for: {project_data.get('name', 'Unknown')}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.7,  # More creative for case studies
                max_tokens=5000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            if not result or not result.get('case_studies'):
                result = self._generate_fallback_case_studies(project_data, industry, case_count)
            
            return {
                'success': True,
                'case_studies': result.get('case_studies', []),
                'summary': result.get('summary', {}),
                'case_count': len(result.get('case_studies', [])),
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Case study generation error: {str(e)}")
            fallback = self._generate_fallback_case_studies(project_data, industry, case_count)
            return {
                'success': True,  # Return success with fallback
                'case_studies': fallback.get('case_studies', []),
                'summary': fallback.get('summary', {}),
                'case_count': len(fallback.get('case_studies', [])),
                'generated_at': datetime.utcnow().isoformat(),
                'note': 'Generated from templates. Configure LLM for customized case studies.'
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
