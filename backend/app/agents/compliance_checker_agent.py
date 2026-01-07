"""
Compliance Checker Agent

Validates that answers meet regulatory and compliance requirements.
Checks for accuracy of compliance claims against organization certifications.
"""
import logging
import json
import re
from typing import Dict, List, Any

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig

logger = logging.getLogger(__name__)


class ComplianceCheckerAgent:
    """
    Agent that validates compliance-related claims in RFP answers.
    - Detects compliance-sensitive questions (GDPR, HIPAA, SOC2, ISO 27001)
    - Validates answer claims against certifications database
    - Flags unverified compliance statements
    - Suggests compliance-appropriate language
    """
    
    # Supported compliance frameworks
    COMPLIANCE_FRAMEWORKS = {
        'gdpr': {
            'name': 'GDPR',
            'full_name': 'General Data Protection Regulation',
            'keywords': ['gdpr', 'general data protection', 'eu privacy', 'european data', 'data subject rights', 'dpa', 'data protection officer'],
            'risk_level': 'high'
        },
        'hipaa': {
            'name': 'HIPAA',
            'full_name': 'Health Insurance Portability and Accountability Act',
            'keywords': ['hipaa', 'health information', 'phi', 'protected health', 'healthcare compliance', 'covered entity'],
            'risk_level': 'high'
        },
        'soc2': {
            'name': 'SOC 2',
            'full_name': 'Service Organization Control 2',
            'keywords': ['soc 2', 'soc2', 'soc ii', 'type i', 'type ii', 'service organization control'],
            'risk_level': 'high'
        },
        'iso27001': {
            'name': 'ISO 27001',
            'full_name': 'ISO/IEC 27001 Information Security Management',
            'keywords': ['iso 27001', 'iso27001', 'information security', 'isms', 'iso 27k'],
            'risk_level': 'medium'
        },
        'pci_dss': {
            'name': 'PCI DSS',
            'full_name': 'Payment Card Industry Data Security Standard',
            'keywords': ['pci', 'pci dss', 'payment card', 'cardholder data'],
            'risk_level': 'high'
        },
        'fedramp': {
            'name': 'FedRAMP',
            'full_name': 'Federal Risk and Authorization Management Program',
            'keywords': ['fedramp', 'federal risk', 'government cloud', 'federal authorization'],
            'risk_level': 'high'
        },
        'ccpa': {
            'name': 'CCPA',
            'full_name': 'California Consumer Privacy Act',
            'keywords': ['ccpa', 'california privacy', 'california consumer', 'cpra'],
            'risk_level': 'medium'
        },
        'sox': {
            'name': 'SOX',
            'full_name': 'Sarbanes-Oxley Act',
            'keywords': ['sarbanes', 'sox', 'financial controls', 'audit controls'],
            'risk_level': 'high'
        },
        # Regional Privacy Regulations
        'pdpa': {
            'name': 'PDPA',
            'full_name': 'Personal Data Protection Act (Singapore)',
            'keywords': ['pdpa', 'singapore privacy', 'singapore data protection', 'pdpc'],
            'risk_level': 'medium',
            'region': 'Singapore'
        },
        'lgpd': {
            'name': 'LGPD',
            'full_name': 'Lei Geral de Proteção de Dados (Brazil)',
            'keywords': ['lgpd', 'brazil privacy', 'brazilian data', 'lei geral'],
            'risk_level': 'medium',
            'region': 'Brazil'
        },
        'pipl': {
            'name': 'PIPL',
            'full_name': 'Personal Information Protection Law (China)',
            'keywords': ['pipl', 'china privacy', 'chinese data protection', 'china data law'],
            'risk_level': 'high',
            'region': 'China'
        },
        'pipeda': {
            'name': 'PIPEDA',
            'full_name': 'Personal Information Protection and Electronic Documents Act (Canada)',
            'keywords': ['pipeda', 'canada privacy', 'canadian data protection'],
            'risk_level': 'medium',
            'region': 'Canada'
        },
        'appi': {
            'name': 'APPI',
            'full_name': 'Act on Protection of Personal Information (Japan)',
            'keywords': ['appi', 'japan privacy', 'japanese data protection'],
            'risk_level': 'medium',
            'region': 'Japan'
        },
        'dpdp': {
            'name': 'DPDP',
            'full_name': 'Digital Personal Data Protection Act (India)',
            'keywords': ['dpdp', 'india privacy', 'indian data protection', 'dpdp act'],
            'risk_level': 'medium',
            'region': 'India'
        }
    }
    
    # Certification expiry tracking configuration
    CERTIFICATION_EXPIRY_CONFIG = {
        'warning_days': 90,  # Days before expiry to warn
        'critical_days': 30,  # Days before expiry to flag critical
        'renewal_reminder_days': 180,  # Days before to send renewal reminder
        'expires_annually': ['SOC 2', 'ISO 27001', 'PCI DSS'],
        'expires_biennially': ['FedRAMP'],
        'no_expiry': ['GDPR', 'CCPA', 'HIPAA', 'PDPA', 'LGPD']  # Regulatory compliance, not certifications
    }

    
    COMPLIANCE_CHECK_PROMPT = """You are a compliance expert reviewing RFP answers for regulatory accuracy.

## Answer to Review
{answer}

## Question Context
Category: {category}
Question: {question}

## Detected Compliance Frameworks
{detected_frameworks}

## Organization's Verified Certifications
{org_certifications}

## Task
Analyze this answer for compliance-related claims and validate them:

1. **Identify Claims**: Find all statements about certifications, compliance, or security controls
2. **Verify Against Certs**: Check if claims match the organization's verified certifications
3. **Flag Issues**: Highlight unverified, overstated, or potentially false claims
4. **Risk Assessment**: Rate the risk if this answer is submitted as-is
5. **Suggested Revisions**: Provide safer, more accurate language

## Response Format (JSON only)
{{
  "compliance_claims": [
    {{
      "claim_text": "The specific claim made",
      "framework": "GDPR|HIPAA|SOC2|ISO27001|PCI|FEDRAMP|CCPA|SOX|OTHER",
      "claim_status": "verified|unverified|overstated|false",
      "risk_level": "critical|high|medium|low",
      "explanation": "Why this status was assigned"
    }}
  ],
  "overall_compliance_score": 0.0-1.0,
  "risk_areas": ["List of high-risk areas"],
  "recommended_revisions": [
    {{
      "original": "Original problematic text",
      "revised": "Safer revised text",
      "reason": "Why this change is needed"
    }}
  ],
  "requires_legal_review": true/false,
  "legal_review_reason": "Why legal review is needed if applicable",
  "revised_answer": "Complete revised answer with safer language"
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "ComplianceCheckerAgent"
        self.org_id = org_id
    
    def check_compliance(
        self,
        answers: List[Dict] = None,
        org_certifications: List[str] = None,
        session_state: Dict = None
    ) -> Dict:
        """
        Check answers for compliance issues.
        
        Args:
            answers: List of answers to check
            org_certifications: List of organization's verified certifications
            session_state: Shared state
            
        Returns:
            Compliance check results with scores and revisions
        """
        session_state = session_state or {}
        
        # Get answers from session if not provided
        answers = answers or session_state.get(SessionKeys.DRAFT_ANSWERS, [])
        
        if not answers:
            return {"success": False, "error": "No answers to check"}
        
        # Get organization certifications from database if not provided
        if org_certifications is None:
            org_certifications = self._get_org_certifications()
        
        checked_answers = []
        compliance_issues = []
        requires_legal_review = False
        
        for answer in answers:
            category = answer.get("category", "general")
            
            # Check if this is a compliance-sensitive question
            if self._is_compliance_sensitive(answer):
                try:
                    check_result = self._check_single_answer(
                        answer=answer,
                        org_certifications=org_certifications
                    )
                    
                    # Track issues
                    if check_result.get("compliance_claims"):
                        for claim in check_result["compliance_claims"]:
                            if claim.get("claim_status") in ["unverified", "overstated", "false"]:
                                compliance_issues.append({
                                    "question_id": answer.get("question_id"),
                                    "claim": claim
                                })
                    
                    if check_result.get("requires_legal_review"):
                        requires_legal_review = True
                    
                    checked_answer = {
                        **answer,
                        "compliance_check": check_result,
                        "compliance_score": check_result.get("overall_compliance_score", 1.0)
                    }
                    
                except Exception as e:
                    logger.error(f"Compliance check failed: {e}")
                    checked_answer = {
                        **answer,
                        "compliance_check": {"error": str(e)},
                        "compliance_score": 0.5
                    }
            else:
                # Non-compliance question, pass through
                checked_answer = {
                    **answer,
                    "compliance_check": None,
                    "compliance_score": 1.0
                }
            
            checked_answers.append(checked_answer)
        
        # Store in session state
        session_state["compliance_checked_answers"] = checked_answers
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        compliance_sensitive = len([a for a in checked_answers if a.get("compliance_check")])
        avg_score = sum(a["compliance_score"] for a in checked_answers) / len(checked_answers) if checked_answers else 0
        messages.append({
            "agent": self.name,
            "action": "compliance_checked",
            "summary": f"Checked {compliance_sensitive} compliance-sensitive answers (avg score: {avg_score:.0%}, {len(compliance_issues)} issues found)"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "checked_answers": checked_answers,
            "stats": {
                "total_answers": len(checked_answers),
                "compliance_sensitive": compliance_sensitive,
                "issues_found": len(compliance_issues),
                "average_score": round(avg_score, 2),
                "requires_legal_review": requires_legal_review
            },
            "compliance_issues": compliance_issues,
            "session_state": session_state
        }
    
    def _is_compliance_sensitive(self, answer: Dict) -> bool:
        """Check if a question/answer involves compliance topics."""
        category = answer.get("category", "").lower()
        text = f"{answer.get('question_text', '')} {answer.get('answer', '')}".lower()
        
        # Category-based check
        if category in ["compliance", "security", "legal"]:
            return True
        
        # Keyword-based check
        for framework_id, framework in self.COMPLIANCE_FRAMEWORKS.items():
            for keyword in framework["keywords"]:
                if keyword in text:
                    return True
        
        return False
    
    def _detect_frameworks(self, text: str) -> List[Dict]:
        """Detect which compliance frameworks are mentioned in text."""
        text_lower = text.lower()
        detected = []
        
        for framework_id, framework in self.COMPLIANCE_FRAMEWORKS.items():
            for keyword in framework["keywords"]:
                if keyword in text_lower:
                    detected.append({
                        "id": framework_id,
                        "name": framework["name"],
                        "full_name": framework["full_name"],
                        "risk_level": framework["risk_level"]
                    })
                    break  # Only add each framework once
        
        return detected
    
    def _get_org_certifications(self) -> List[str]:
        """Get organization's verified certifications from database."""
        try:
            if not self.org_id:
                return []
            
            from app.models import Organization
            org = Organization.query.get(self.org_id)
            if org and org.settings:
                vendor_profile = org.settings.get("vendor_profile", {})
                return vendor_profile.get("certifications", [])
        except Exception as e:
            logger.warning(f"Could not fetch org certifications: {e}")
        
        return []
    
    @with_retry(
        config=RetryConfig(max_attempts=2, initial_delay=0.5),
        fallback_models=['gemini-1.5-pro']
    )
    def _check_single_answer(
        self,
        answer: Dict,
        org_certifications: List[str]
    ) -> Dict:
        """Check a single answer for compliance issues."""
        client = self.config.client
        if not client:
            return self._fallback_check(answer, org_certifications)
        
        answer_text = answer.get("answer", "")
        question_text = answer.get("question_text", "")
        category = answer.get("category", "general")
        
        # Detect frameworks mentioned
        combined_text = f"{question_text} {answer_text}"
        detected = self._detect_frameworks(combined_text)
        
        prompt = self.COMPLIANCE_CHECK_PROMPT.format(
            answer=answer_text,
            question=question_text,
            category=category,
            detected_frameworks=json.dumps(detected, indent=2) if detected else "None detected",
            org_certifications=", ".join(org_certifications) if org_certifications else "No certifications on file"
        )
        
        try:
            if self.config.is_adk_enabled:
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=prompt
                )
                response_text = response.text
            else:
                response = client.generate_content(prompt)
                response_text = response.text
            
            # Clean and parse JSON
            response_text = response_text.strip()
            if response_text.startswith('```'):
                response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            return json.loads(response_text)
            
        except Exception as e:
            logger.error(f"Compliance check error: {e}")
            return self._fallback_check(answer, org_certifications)
    
    def _fallback_check(self, answer: Dict, org_certifications: List[str]) -> Dict:
        """Fallback compliance check when AI is unavailable."""
        answer_text = answer.get("answer", "").lower()
        
        # Simple keyword detection
        claims = []
        for framework_id, framework in self.COMPLIANCE_FRAMEWORKS.items():
            for keyword in framework["keywords"]:
                if keyword in answer_text:
                    # Check if org has this certification
                    has_cert = any(
                        framework["name"].lower() in cert.lower() 
                        for cert in org_certifications
                    )
                    claims.append({
                        "claim_text": f"Mentions {framework['name']}",
                        "framework": framework["name"],
                        "claim_status": "verified" if has_cert else "unverified",
                        "risk_level": framework["risk_level"],
                        "explanation": "Verified against org certifications" if has_cert else "Certification not on file"
                    })
                    break
        
        unverified = len([c for c in claims if c["claim_status"] != "verified"])
        
        return {
            "compliance_claims": claims,
            "overall_compliance_score": 1.0 - (unverified * 0.2) if claims else 1.0,
            "risk_areas": [c["framework"] for c in claims if c["claim_status"] != "verified"],
            "recommended_revisions": [],
            "requires_legal_review": unverified > 0,
            "legal_review_reason": "AI review unavailable - manual review recommended" if unverified > 0 else None,
            "revised_answer": answer.get("answer", "")
        }


def get_compliance_checker_agent(org_id: int = None) -> ComplianceCheckerAgent:
    """Factory function to get Compliance Checker Agent."""
    return ComplianceCheckerAgent(org_id=org_id)
