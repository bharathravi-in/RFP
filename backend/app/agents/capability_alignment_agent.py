"""
Capability Alignment Agent

Maps client needs to vendor strengths with proof points.
This is the core alignment engine for Capability-Led Proposals.

Uses:
- VendorProfileAgent (vendor capabilities)
- CaseStudyAgent (proof points)
- KnowledgeBaseAgent (domain expertise)
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class CapabilityAlignmentAgent:
    """
    Agent for mapping client needs to vendor strengths.
    
    This is the core value-add for Capability-Led Proposals.
    
    Features:
    - Map client needs → vendor capabilities
    - Find proof points for each alignment
    - Score alignment strength
    - Generate talking points
    - Identify gaps to address
    
    LLM: ✅ | KB: ✅
    """
    
    MASTER_PROMPT = """You are a Strategic Proposal Consultant creating a capability alignment map.

Your task is to map the client's identified needs to our vendor capabilities and find proof points.

## Client Context:
{client_context}

## Vendor Capabilities:
{vendor_capabilities}

## Available Case Studies:
{case_studies}

## Output Format
Generate a JSON response with the following structure:
{{
    "alignments": [
        {{
            "alignment_id": "A-001",
            "client_need": {{
                "need_id": "N-001",
                "description": "What the client needs",
                "category": "Technology/Process/etc."
            }},
            "vendor_strength": {{
                "capability": "Our matching capability",
                "description": "How we address this need",
                "expertise_level": "Expert/Proficient/Capable",
                "years_experience": 10
            }},
            "proof_points": [
                {{
                    "type": "case_study",
                    "reference_id": "CS-001",
                    "title": "Case study title",
                    "relevance": "Why this is relevant",
                    "key_metric": "40% cost reduction"
                }}
            ],
            "alignment_score": 0.92,
            "confidence": "High/Medium/Low",
            "talking_points": [
                "We've delivered this 10+ times",
                "Average ROI of 150%",
                "Certified team of 50+ experts"
            ],
            "differentiators": ["What makes us unique here"]
        }}
    ],
    "gaps": [
        {{
            "need_id": "N-003",
            "description": "Need we can't fully address",
            "gap_type": "capability/experience/scale",
            "mitigation": "How we can address this gap",
            "partner_opportunity": true
        }}
    ],
    "overall_alignment": {{
        "score": 0.85,
        "strong_areas": ["Cloud", "AI/ML"],
        "areas_to_strengthen": ["IoT"],
        "competitive_position": "Strong/Moderate/Challenging",
        "win_probability_impact": "+15%"
    }},
    "recommended_emphasis": [
        "Lead with cloud migration expertise",
        "Highlight healthcare industry experience",
        "De-emphasize IoT, offer partner solution"
    ]
}}

## Guidelines:
1. Be honest about gaps - they can be addressed
2. Use real case study references where available
3. Score alignment objectively
4. Provide specific, quantifiable talking points
5. Consider competitive dynamics
6. Prioritize alignments by client need urgency

Generate the alignment map now:"""

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='capability_alignment')
        logger.info(f"CapabilityAlignmentAgent initialized with provider: {self.config.provider}")
    
    def align_capabilities(
        self,
        client_context: Dict[str, Any],
        vendor_profile: Dict[str, Any] = None,
        case_studies: List[Dict] = None,
        knowledge_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Map client needs to vendor capabilities with proof points.
        
        Args:
            client_context: Structured client context (from CapabilityContextAgent)
            vendor_profile: Vendor capabilities and strengths
            case_studies: Available case studies for proof points
            knowledge_context: Additional KB context
            
        Returns:
            Dict with alignment mapping and recommendations
        """
        try:
            # Get vendor profile if not provided
            if not vendor_profile:
                vendor_profile = self._get_vendor_profile()
            
            # Get case studies if not provided
            if not case_studies:
                case_studies = self._get_relevant_case_studies(client_context)
            
            # Generate alignment using AI
            prompt = self.MASTER_PROMPT.format(
                client_context=json.dumps(client_context, indent=2),
                vendor_capabilities=json.dumps(vendor_profile, indent=2),
                case_studies=json.dumps(case_studies, indent=2)
            )
            
            logger.info(f"Generating capability alignment for org={self.org_id}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.4,  # More analytical
                max_tokens=5000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            if not result or not result.get('alignments'):
                result = self._generate_fallback_alignment(client_context, vendor_profile)
            
            # Calculate overall score
            alignments = result.get('alignments', [])
            avg_score = sum(a.get('alignment_score', 0.5) for a in alignments) / max(len(alignments), 1)
            
            return {
                'success': True,
                'alignments': alignments,
                'gaps': result.get('gaps', []),
                'overall_alignment': result.get('overall_alignment', {}),
                'recommended_emphasis': result.get('recommended_emphasis', []),
                'alignment_count': len(alignments),
                'average_score': round(avg_score * 100, 1),
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Capability alignment error: {str(e)}")
            fallback = self._generate_fallback_alignment(client_context, vendor_profile or {})
            return {
                'success': False,
                'error': str(e),
                'alignments': fallback.get('alignments', []),
                'gaps': [],
                'overall_alignment': {'score': 0.5},
                'generated_at': datetime.utcnow().isoformat(),
            }
    
    def _get_vendor_profile(self) -> Dict:
        """Get vendor profile from database."""
        try:
            from app.models import VendorProfile, VendorCapability
            
            profile = VendorProfile.query.filter_by(organization_id=self.org_id).first()
            if profile:
                capabilities = VendorCapability.query.filter_by(
                    organization_id=self.org_id
                ).all()
                
                return {
                    'company_name': profile.company_name,
                    'company_overview': profile.company_overview,
                    'core_competencies': profile.core_competencies or [],
                    'industries_served': profile.industries_served or [],
                    'capabilities': [
                        {
                            'name': c.name,
                            'description': c.description,
                            'expertise_level': c.expertise_level,
                        }
                        for c in capabilities
                    ]
                }
        except Exception as e:
            logger.warning(f"Could not load vendor profile: {e}")
        
        return {
            'company_name': 'Our Company',
            'core_competencies': ['Software Development', 'Cloud Solutions', 'Digital Transformation'],
            'capabilities': []
        }
    
    def _get_relevant_case_studies(self, client_context: Dict) -> List[Dict]:
        """Get relevant case studies from database."""
        try:
            from app.models import CaseStudy
            
            industry = client_context.get('client_overview', {}).get('industry')
            
            case_studies = CaseStudy.get_relevant_case_studies(
                organization_id=self.org_id,
                industry=industry,
                limit=5
            )
            
            return [cs.to_context_dict() for cs in case_studies]
        except Exception as e:
            logger.warning(f"Could not load case studies: {e}")
        
        return []
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract alignment JSON."""
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
            
            logger.warning("Could not parse capability alignment response")
            return {}
    
    def _generate_fallback_alignment(self, client_context: Dict, vendor_profile: Dict) -> Dict:
        """Generate fallback alignment when AI fails."""
        needs = client_context.get('identified_needs', [])
        
        alignments = []
        for i, need in enumerate(needs[:5]):
            alignments.append({
                'alignment_id': f'A-{i+1:03d}',
                'client_need': {
                    'need_id': need.get('need_id', f'N-{i+1:03d}'),
                    'description': need.get('description', 'General need'),
                },
                'vendor_strength': {
                    'capability': 'Consulting and Implementation',
                    'description': 'We can address this through our delivery methodology',
                },
                'proof_points': [],
                'alignment_score': 0.6,
                'confidence': 'Medium',
                'talking_points': ['Experienced team', 'Proven methodology'],
            })
        
        return {
            'alignments': alignments,
            'gaps': [],
            'overall_alignment': {
                'score': 0.6,
                'competitive_position': 'Moderate',
            },
            '_fallback': True
        }


def get_capability_alignment_agent(org_id: int = None) -> CapabilityAlignmentAgent:
    """Factory function to get Capability Alignment Agent."""
    return CapabilityAlignmentAgent(org_id=org_id)
