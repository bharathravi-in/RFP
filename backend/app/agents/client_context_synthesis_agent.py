"""
Client Context Synthesis Agent

Forces context grounding BEFORE any proposal generation.
Extracts client-specific constraints, success definitions, and forbidden references.

CRITICAL: Proposal generation MUST FAIL without this context.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional

from .config import get_agent_config

logger = logging.getLogger(__name__)


class ClientContextSynthesisAgent:
    """
    Agent that synthesizes client context from RFP data.
    
    This is the MANDATORY first step before any proposal generation.
    Without this context, other agents cannot produce client-specific content.
    
    Outputs:
    - client_context: What problem we're solving
    - domain_constraints: Sector-specific requirements
    - success_definition: How success will be measured
    - forbidden_references: What must NOT appear in the proposal
    """
    
    # Domain-specific knowledge for inference
    DOMAIN_KNOWLEDGE = {
        'healthcare': {
            'keywords': ['health', 'medical', 'clinical', 'patient', 'hospital', 'doctor', 'nurse', 'frontline', 'lmic', 'care'],
            'constraints': ['offline-first capability', 'low digital literacy users', 'clinical safety', 'data privacy (HIPAA/GDPR)', 'resource-constrained settings'],
            'success_metrics': ['improved patient outcomes', 'protocol adherence', 'reduced errors', 'behavior change', 'time savings'],
            'forbidden': ['SAP', 'ERP', 'enterprise workflow', 'corporate', 'manufacturing', 'retail', 'banking']
        },
        'ngo': {
            'keywords': ['foundation', 'donor', 'humanitarian', 'development', 'impact', 'beneficiary', 'program', 'grant'],
            'constraints': ['budget transparency', 'donor reporting', 'impact measurement', 'sustainability', 'local capacity'],
            'success_metrics': ['lives improved', 'cost per beneficiary', 'scalability', 'sustainability score'],
            'forbidden': ['profit margin', 'revenue', 'shareholder', 'commercial']
        },
        'government': {
            'keywords': ['government', 'public sector', 'citizen', 'ministry', 'department', 'regulatory', 'compliance'],
            'constraints': ['regulatory compliance', 'transparency', 'accessibility', 'security clearance', 'procurement rules'],
            'success_metrics': ['citizen satisfaction', 'service efficiency', 'compliance rate', 'cost savings'],
            'forbidden': ['startup', 'agile-only', 'move fast']
        },
        'enterprise': {
            'keywords': ['enterprise', 'corporate', 'business', 'erp', 'sap', 'workflow', 'automation'],
            'constraints': ['integration with existing systems', 'change management', 'ROI justification', 'security'],
            'success_metrics': ['ROI', 'efficiency gains', 'cost reduction', 'time savings'],
            'forbidden': []
        }
    }
    
    # Organization-specific knowledge (can be expanded)
    KNOWN_ORGANIZATIONS = {
        'medtronic': {
            'full_name': 'Medtronic LABS',
            'domain': 'healthcare',
            'focus': 'frontline health workers in low and middle-income countries (LMICs)',
            'constraints': ['offline-first', 'low digital literacy', 'clinical safety', 'resource-constrained'],
            'forbidden': ['SAP', 'ERP', 'enterprise workflow', 'RAK Ceramics', 'Zurich', 'banking', 'retail']
        },
        'rak ceramics': {
            'full_name': 'RAK Ceramics',
            'domain': 'enterprise',
            'focus': 'manufacturing and enterprise systems',
            'constraints': ['SAP integration', 'manufacturing processes'],
            'forbidden': ['healthcare', 'patient', 'clinical', 'medical']
        }
    }
    
    SYNTHESIS_PROMPT = """You are a Senior Solution Architect analyzing an RFP to extract the CLIENT-SPECIFIC context.

## RFP INFORMATION
Title: {rfp_title}
Client Name: {client_name}
Industry/Sector: {industry}
Description: {description}

## DETECTED DOMAIN: {detected_domain}
## DOMAIN CONSTRAINTS: {domain_constraints}

## YOUR TASK
Synthesize a clear client context that ALL proposal agents will use.

YOU MUST:
1. Identify the SPECIFIC problem the client is trying to solve
2. List constraints that are UNIQUE to this client/sector
3. Define what SUCCESS looks like for THIS client
4. List terms/references that must NOT appear (cross-contamination prevention)

## OUTPUT (JSON ONLY)
{{
  "client_name": "{client_name}",
  "client_context": "One paragraph describing what problem this client needs solved, written as if you understand their world",
  "domain": "{detected_domain}",
  "sector_constraints": ["constraint 1", "constraint 2"],
  "client_specific_constraints": ["constraint specific to this client"],
  "success_definition": "How this client will measure success - be specific",
  "key_terminology": ["terms this client uses that we must echo"],
  "forbidden_references": ["terms that must NOT appear in this proposal"],
  "inference_confidence": 0.0-1.0,
  "confidence_level": "HIGH|MEDIUM|LOW",
  "confidence_rationale": "Why this confidence level",
  "assumptions_made": ["assumption 1", "assumption 2"],
  "validation_requirements": {{
    "must_verify": ["claims that must be verified before submission"],
    "client_review_needed": ["areas needing client confirmation"]
  }},
  "proposal_guidance": {{
    "tone": "formal|semi-formal|informal",
    "emphasis": "What to emphasize",
    "avoid": "What to avoid beyond forbidden terms"
  }}
}}

CRITICAL RULES:
- If this is a HEALTHCARE proposal, SAP/ERP/enterprise workflow are FORBIDDEN
- If this is an ENTERPRISE proposal, clinical/patient/medical are FORBIDDEN
- State assumptions explicitly - this builds trust
- Be specific, not generic

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='proposal_writer')
        self.name = "ClientContextSynthesisAgent"
    
    def synthesize_context(
        self,
        rfp_title: str = "",
        client_name: str = "",
        industry: str = "",
        description: str = "",
        rfp_analysis: Dict = None
    ) -> Dict[str, Any]:
        """
        Synthesize client context from RFP data.
        
        THIS IS MANDATORY before any proposal generation.
        
        Args:
            rfp_title: Title of the RFP
            client_name: Name of the client organization
            industry: Industry/sector
            description: RFP description
            rfp_analysis: Optional analysis from DocumentAnalyzerAgent
            
        Returns:
            Client context with constraints, success definition, forbidden references
        """
        # Step 1: Detect domain from keywords
        detected_domain = self._detect_domain(rfp_title, client_name, industry, description)
        
        # Step 2: Check for known organization
        org_context = self._check_known_organization(client_name)
        
        # Step 3: Get domain-specific constraints
        domain_info = self.DOMAIN_KNOWLEDGE.get(detected_domain, self.DOMAIN_KNOWLEDGE['enterprise'])
        
        # Step 4: Build forbidden references list
        forbidden = self._build_forbidden_list(detected_domain, org_context)
        
        # Step 5: Try AI synthesis if available
        try:
            ai_context = self._synthesize_with_ai(
                rfp_title=rfp_title,
                client_name=client_name,
                industry=industry,
                description=description,
                detected_domain=detected_domain,
                domain_constraints=domain_info['constraints']
            )
            
            # Merge AI context with our rules
            ai_context['forbidden_references'] = list(set(
                ai_context.get('forbidden_references', []) + forbidden
            ))
            
            return {
                'success': True,
                'context': ai_context,
                'source': 'ai_synthesized'
            }
            
        except Exception as e:
            logger.warning(f"AI synthesis failed, using rule-based: {e}")
            return self._fallback_synthesis(
                rfp_title=rfp_title,
                client_name=client_name,
                detected_domain=detected_domain,
                domain_info=domain_info,
                org_context=org_context,
                forbidden=forbidden,
                description=description
            )
    
    def _detect_domain(self, rfp_title: str, client_name: str, industry: str, description: str) -> str:
        """Detect the domain from RFP content."""
        combined_text = f"{rfp_title} {client_name} {industry} {description}".lower()
        
        scores = {}
        for domain, info in self.DOMAIN_KNOWLEDGE.items():
            score = sum(1 for kw in info['keywords'] if kw in combined_text)
            scores[domain] = score
        
        if scores:
            best_domain = max(scores, key=scores.get)
            if scores[best_domain] > 0:
                return best_domain
        
        return 'enterprise'  # Default
    
    def _check_known_organization(self, client_name: str) -> Optional[Dict]:
        """Check if client is a known organization."""
        client_lower = client_name.lower()
        
        for org_key, org_info in self.KNOWN_ORGANIZATIONS.items():
            if org_key in client_lower:
                return org_info
        
        return None
    
    def _build_forbidden_list(self, detected_domain: str, org_context: Optional[Dict]) -> List[str]:
        """Build list of forbidden references to prevent cross-contamination."""
        forbidden = []
        
        # Add domain-specific forbidden terms
        domain_info = self.DOMAIN_KNOWLEDGE.get(detected_domain, {})
        forbidden.extend(domain_info.get('forbidden', []))
        
        # Add organization-specific forbidden terms
        if org_context:
            forbidden.extend(org_context.get('forbidden', []))
        
        # Add common cross-contamination terms
        if detected_domain == 'healthcare':
            forbidden.extend(['RAK Ceramics', 'Zurich Kotak', 'SAP MDM', 'S/4HANA', 'enterprise workflow'])
        elif detected_domain == 'enterprise':
            forbidden.extend(['frontline health', 'clinical', 'patient care', 'LMIC'])
        
        return list(set(forbidden))
    
    def _synthesize_with_ai(
        self,
        rfp_title: str,
        client_name: str,
        industry: str,
        description: str,
        detected_domain: str,
        domain_constraints: List[str]
    ) -> Dict[str, Any]:
        """Use AI to synthesize context."""
        client = self.config.client
        if not client:
            raise Exception("No AI client available")
        
        prompt = self.SYNTHESIS_PROMPT.format(
            rfp_title=rfp_title or "Not specified",
            client_name=client_name or "Client",
            industry=industry or detected_domain,
            description=description or "No description provided",
            detected_domain=detected_domain,
            domain_constraints=", ".join(domain_constraints)
        )
        
        if self.config.is_adk_enabled:
            response = client.models.generate_content(
                model=self.config.model_name,
                contents=prompt
            )
            response_text = response.text
        else:
            response = client.generate_content(prompt)
            response_text = response.text
        
        # Parse JSON
        response_text = response_text.strip()
        if response_text.startswith('```'):
            response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
            response_text = re.sub(r'\n?```$', '', response_text)
        
        return json.loads(response_text)
    
    def _fallback_synthesis(
        self,
        rfp_title: str,
        client_name: str,
        detected_domain: str,
        domain_info: Dict,
        org_context: Optional[Dict],
        forbidden: List[str],
        description: str
    ) -> Dict[str, Any]:
        """Rule-based fallback synthesis."""
        
        # Build context based on domain
        if detected_domain == 'healthcare':
            client_context = f"{client_name or 'The client'} focuses on improving health outcomes, likely for frontline workers or patients in resource-constrained settings. Solutions must be practical, offline-capable, and designed for users with varying digital literacy."
            success_def = "Improved health outcomes, increased protocol adherence, reduced errors, measurable behavior change among health workers."
        elif detected_domain == 'ngo':
            client_context = f"{client_name or 'The organization'} is focused on humanitarian or development impact. Solutions must be cost-effective, sustainable, and measurable for donor reporting."
            success_def = "Measurable impact on beneficiaries, cost efficiency, sustainability, donor satisfaction."
        elif detected_domain == 'government':
            client_context = f"{client_name or 'The agency'} requires solutions that meet regulatory compliance, ensure transparency, and serve citizens effectively."
            success_def = "Improved citizen services, regulatory compliance, operational efficiency."
        else:
            client_context = f"{client_name or 'The client'} seeks enterprise solutions that integrate with existing systems and deliver measurable ROI."
            success_def = "ROI achievement, process efficiency, successful integration."
        
        # Use org-specific context if available
        if org_context:
            client_context = f"{org_context['full_name']} focuses on {org_context['focus']}. {client_context}"
        
        return {
            'success': True,
            'context': {
                'client_name': client_name or 'Client',
                'client_context': client_context,
                'domain': detected_domain,
                'sector_constraints': domain_info.get('constraints', []),
                'client_specific_constraints': org_context.get('constraints', []) if org_context else [],
                'success_definition': success_def,
                'key_terminology': domain_info.get('keywords', [])[:5],
                'forbidden_references': forbidden,
                'inference_confidence': 0.7,
                'assumptions_made': [
                    f"Domain detected as {detected_domain} based on keywords",
                    "Constraints inferred from sector best practices"
                ]
            },
            'source': 'rule_based'
        }
    
    def validate_content(self, content: str, context: Dict) -> Dict[str, Any]:
        """
        Validate that content doesn't contain forbidden references.
        
        Args:
            content: The content to validate
            context: The client context with forbidden_references
            
        Returns:
            Validation result with violations found
        """
        content_lower = content.lower()
        forbidden = context.get('forbidden_references', [])
        
        violations = []
        for term in forbidden:
            if term.lower() in content_lower:
                violations.append(term)
        
        return {
            'valid': len(violations) == 0,
            'violations': violations,
            'message': f"Content contains forbidden references: {', '.join(violations)}" if violations else "Content is valid"
        }


def get_client_context_synthesis_agent(org_id: int = None) -> ClientContextSynthesisAgent:
    """Factory function to get Client Context Synthesis Agent."""
    return ClientContextSynthesisAgent(org_id=org_id)
