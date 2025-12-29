"""
Legal Review Agent

AI-powered legal review for RFP proposals.
Checks for:
- Risky contractual language
- NDA and confidentiality compliance
- Liability and indemnification clauses
- Compliance with standard terms
- Missing required legal elements

Uses configured LLM provider (LiteLLM/Google/OpenAI) from organization settings.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class LegalReviewAgent:
    """
    Agent for reviewing legal aspects of RFP proposals.
    
    Features:
    - Risk identification in proposal language
    - NDA/Confidentiality clause checking
    - Standard terms compliance
    - Liability and indemnification review
    - Missing clause detection
    """
    
    MASTER_PROMPT = """You are a Senior Legal Counsel specializing in technology contracts and RFP proposals.

Your task is to review the proposal content for legal risks, compliance issues, and missing protections.

## Content to Review:
{review_context}

## Output Format
Generate a JSON response with the following structure:
{{
  "overall_risk_level": "low|medium|high|critical",
  "review_summary": "Brief summary of legal review findings",
  "risk_items": [
    {{
      "risk_id": "RISK-001",
      "category": "Liability|IP|Confidentiality|Indemnification|Payment|Termination|Compliance",
      "severity": "low|medium|high|critical",
      "description": "Description of the risk",
      "location": "Section or clause where found",
      "recommendation": "Suggested mitigation or revision",
      "suggested_language": "Optional: Suggested replacement text"
    }}
  ],
  "missing_clauses": [
    {{
      "clause_type": "Type of missing clause",
      "importance": "required|recommended|optional",
      "description": "Why this clause should be included",
      "suggested_language": "Standard language to add"
    }}
  ],
  "compliant_areas": [
    "List of areas that are properly covered"
  ],
  "recommendations": [
    "General recommendations for legal improvement"
  ]
}}

## Legal Review Checklist:
1. **Liability & Indemnification**
   - Check for unlimited liability exposure
   - Review indemnification scope
   - Verify limitation of liability clauses

2. **Intellectual Property**
   - Clarify IP ownership (pre-existing vs new)
   - Check licensing terms
   - Review IP assignment clauses

3. **Confidentiality**
   - Verify NDA/confidentiality provisions
   - Check information handling requirements
   - Review disclosure exceptions

4. **Payment Terms**
   - Review payment milestones
   - Check late payment provisions
   - Verify invoice terms

5. **Termination**
   - Check termination for convenience
   - Review termination for cause
   - Verify notice periods

6. **Compliance**
   - Data protection (GDPR, CCPA)
   - Industry regulations
   - Security certifications

## Guidelines:
- Be thorough but practical
- Prioritize high-impact risks
- Provide actionable recommendations
- Suggest specific language improvements
- Flag any regulatory compliance concerns

Perform the legal review now:"""

    # Standard clauses that should be present
    REQUIRED_CLAUSES = [
        {'type': 'limitation_of_liability', 'name': 'Limitation of Liability'},
        {'type': 'confidentiality', 'name': 'Confidentiality/NDA'},
        {'type': 'ip_ownership', 'name': 'Intellectual Property Rights'},
        {'type': 'data_protection', 'name': 'Data Protection/Privacy'},
        {'type': 'termination', 'name': 'Termination Provisions'},
    ]
    
    # Risk keywords to detect
    RISK_KEYWORDS = {
        'high_risk': [
            'unlimited liability', 'full indemnification', 'sole discretion',
            'without limitation', 'in perpetuity', 'irrevocable assignment',
            'all intellectual property', 'automatic renewal'
        ],
        'medium_risk': [
            'best efforts', 'reasonable efforts', 'subject to change',
            'as soon as practicable', 'from time to time', 'as may be',
            'including but not limited to'
        ],
        'compliance': [
            'gdpr', 'ccpa', 'hipaa', 'sox', 'pci-dss', 'iso 27001',
            'soc 2', 'data protection', 'personal data'
        ]
    }

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='legal_review')
        logger.info(f"LegalReviewAgent initialized with provider: {self.config.provider}")
    
    def review_proposal(
        self,
        sections: List[Dict[str, Any]],
        project_data: Dict[str, Any] = None,
        vendor_profile: Dict[str, Any] = None,
        check_mode: str = 'full'
    ) -> Dict[str, Any]:
        """
        Perform legal review of proposal sections.
        
        Args:
            sections: List of proposal sections with content
            project_data: Project information
            vendor_profile: Vendor/company information
            check_mode: Review mode ('full', 'quick', 'compliance_only')
            
        Returns:
            Dict with legal review findings and recommendations
        """
        try:
            # Build review context
            review_context = self._build_review_context(
                sections, project_data, vendor_profile, check_mode
            )
            
            # Run AI review
            prompt = self.MASTER_PROMPT.format(review_context=json.dumps(review_context, indent=2))
            
            logger.info(f"Running legal review for: {project_data.get('name', 'Unknown') if project_data else 'Unknown'}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.3,  # More deterministic for legal
                max_tokens=5000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            # Add keyword-based checks
            keyword_risks = self._check_risk_keywords(sections)
            if keyword_risks:
                existing_risks = result.get('risk_items', [])
                existing_risks.extend(keyword_risks)
                result['risk_items'] = existing_risks
            
            return {
                'success': True,
                'review': result,
                'check_mode': check_mode,
                'reviewed_at': datetime.utcnow().isoformat(),
                'section_count': len(sections),
            }
            
        except Exception as e:
            logger.error(f"Legal review error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'review': self._generate_fallback_review(),
            }
    
    def _build_review_context(
        self,
        sections: List[Dict],
        project_data: Dict,
        vendor_profile: Dict,
        check_mode: str
    ) -> Dict:
        """Build context for the legal review prompt."""
        # Extract content from relevant sections
        legal_content = []
        for section in sections:
            title = section.get('title', '').lower()
            content = section.get('content', '')
            
            # Prioritize legally relevant sections
            is_legal = any(term in title for term in [
                'confidential', 'legal', 'terms', 'pricing', 'payment',
                'liability', 'indemnif', 'compliance', 'security', 'data'
            ])
            
            legal_content.append({
                'title': section.get('title', 'Untitled'),
                'content': content[:2000] if check_mode == 'full' else content[:500],
                'is_legal_section': is_legal
            })
        
        return {
            'project_name': project_data.get('name', 'Untitled') if project_data else 'Unknown',
            'client_name': project_data.get('client_name', 'Client') if project_data else 'Unknown',
            'sections': legal_content,
            'vendor_name': vendor_profile.get('company_name', 'Vendor') if vendor_profile else 'Vendor',
            'check_mode': check_mode,
            'required_clauses': self.REQUIRED_CLAUSES,
        }
    
    def _check_risk_keywords(self, sections: List[Dict]) -> List[Dict]:
        """Check for risk keywords in content."""
        risks = []
        risk_id_counter = 100
        
        for section in sections:
            content = section.get('content', '').lower()
            title = section.get('title', 'Unknown')
            
            # Check high risk keywords
            for keyword in self.RISK_KEYWORDS['high_risk']:
                if keyword in content:
                    risks.append({
                        'risk_id': f'RISK-{risk_id_counter}',
                        'category': 'Language',
                        'severity': 'high',
                        'description': f'High-risk language detected: "{keyword}"',
                        'location': title,
                        'recommendation': 'Review and consider limiting or removing this language',
                    })
                    risk_id_counter += 1
            
            # Check compliance keywords (informational)
            for keyword in self.RISK_KEYWORDS['compliance']:
                if keyword in content:
                    # This is informational, not a risk
                    logger.debug(f"Compliance term found: {keyword} in {title}")
        
        return risks
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract review JSON."""
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
            
            logger.warning("Could not parse legal review response")
            return self._generate_fallback_review()
    
    def _generate_fallback_review(self) -> Dict:
        """Generate fallback review when AI fails."""
        return {
            'overall_risk_level': 'unknown',
            'review_summary': 'Unable to complete automated legal review. Manual review recommended.',
            'risk_items': [],
            'missing_clauses': [
                {
                    'clause_type': 'Review Required',
                    'importance': 'required',
                    'description': 'Automated review incomplete - manual legal review needed'
                }
            ],
            'recommendations': [
                'Engage legal counsel for comprehensive review',
                'Verify all standard contractual protections are in place'
            ]
        }
    
    def quick_check(self, content: str) -> Dict[str, Any]:
        """
        Quick legal check on a single piece of content.
        
        Args:
            content: Text to check
            
        Returns:
            Dict with quick risk assessment
        """
        risks = []
        
        content_lower = content.lower()
        
        for keyword in self.RISK_KEYWORDS['high_risk']:
            if keyword in content_lower:
                risks.append({
                    'keyword': keyword,
                    'severity': 'high'
                })
        
        for keyword in self.RISK_KEYWORDS['medium_risk']:
            if keyword in content_lower:
                risks.append({
                    'keyword': keyword,
                    'severity': 'medium'
                })
        
        risk_level = 'low'
        if any(r['severity'] == 'high' for r in risks):
            risk_level = 'high'
        elif any(r['severity'] == 'medium' for r in risks):
            risk_level = 'medium'
        
        return {
            'risk_level': risk_level,
            'risks_found': len(risks),
            'details': risks[:5],  # Top 5
        }


def get_legal_review_agent(org_id: int = None) -> LegalReviewAgent:
    """Factory function to get Legal Review Agent."""
    return LegalReviewAgent(org_id=org_id)
