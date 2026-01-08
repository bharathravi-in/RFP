"""
Context Isolation Agent

Prevents cross-proposal contamination by validating content against client context.
Blocks references to other clients, wrong domains, and mismatched terminology.

CRITICAL: Content that fails isolation check must be REJECTED or flagged.
"""
import logging
import re
from typing import Dict, List, Any, Tuple

from .config import get_agent_config

logger = logging.getLogger(__name__)


class ContextIsolationAgent:
    """
    Agent that enforces context isolation to prevent cross-proposal contamination.
    
    Checks:
    1. Client name mismatch (e.g., RAK Ceramics in a Medtronic proposal)
    2. Domain mismatch (e.g., SAP MDM in a healthcare proposal)
    3. Keyword contamination (e.g., manufacturing terms in NGO proposal)
    
    This agent is a GATE - content that fails must be regenerated.
    """
    
    # Known client names that should NEVER appear in other proposals
    KNOWN_CLIENTS = [
        'rak ceramics', 'zurich', 'kotak', 'medtronic', 'pst', 
        'hdfc', 'icici', 'axis bank', 'sbi', 'infosys', 'tcs', 'wipro'
    ]
    
    # Domain-specific terms that MUST NOT cross boundaries
    DOMAIN_BOUNDARIES = {
        'healthcare': {
            'allowed': ['health', 'patient', 'clinical', 'medical', 'care', 'frontline', 'worker', 'protocol', 'compliance', 'training'],
            'blocked': ['erp', 'sap', 'manufacturing', 'retail', 'banking', 'financial', 'ceramic', 'tile', 'mdm', 's/4hana']
        },
        'enterprise': {
            'allowed': ['erp', 'sap', 'workflow', 'automation', 'integration', 'mdm', 'business process'],
            'blocked': ['patient', 'clinical', 'frontline health', 'lmic', 'protocol adherence']
        },
        'ngo': {
            'allowed': ['beneficiary', 'donor', 'impact', 'program', 'grant', 'humanitarian'],
            'blocked': ['shareholder', 'profit margin', 'revenue target', 'stock price']
        }
    }
    
    # Contamination patterns (regex)
    CONTAMINATION_PATTERNS = [
        # Specific client references that often leak
        (r'\brak\s*ceramics?\b', 'RAK Ceramics reference'),
        (r'\bzurich\s*kotak\b', 'Zurich Kotak reference'),
        (r'\bpst\s*migration\b', 'PST migration reference'),
        
        # SAP/Enterprise terms in wrong context
        (r'\bsap\s*(?:mdm|btp|s/4|hana)\b', 'SAP system reference'),
        (r'\bmdmlite\b', 'MDMLite reference'),
        
        # Generic boilerplate that suggests copy-paste
        (r'paperwork\s*reduction.*office', 'Generic paperwork reference'),
    ]
    
    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='proposal_writer')
        self.name = "ContextIsolationAgent"
    
    def validate_content(
        self,
        content: str,
        client_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate content against client context for contamination.
        
        Args:
            content: The content to validate
            client_context: Context from ClientContextSynthesisAgent
            
        Returns:
            Validation result with violations and recommendations
        """
        violations = []
        warnings = []
        
        content_lower = content.lower()
        current_client = client_context.get('client_name', '').lower()
        current_domain = client_context.get('domain', 'enterprise')
        forbidden_refs = client_context.get('forbidden_references', [])
        
        # Check 1: Forbidden references from context
        for ref in forbidden_refs:
            if ref.lower() in content_lower:
                violations.append({
                    'type': 'forbidden_reference',
                    'term': ref,
                    'severity': 'critical',
                    'message': f"Forbidden reference '{ref}' found in content"
                })
        
        # Check 2: Other client names
        for client in self.KNOWN_CLIENTS:
            if client in content_lower and client not in current_client:
                violations.append({
                    'type': 'client_contamination',
                    'term': client,
                    'severity': 'critical',
                    'message': f"Reference to other client '{client}' found"
                })
        
        # Check 3: Contamination patterns
        for pattern, description in self.CONTAMINATION_PATTERNS:
            if re.search(pattern, content_lower):
                # Check if this is allowed for the current domain
                domain_allowed = self.DOMAIN_BOUNDARIES.get(current_domain, {}).get('allowed', [])
                is_allowed = any(allowed in pattern.lower() for allowed in domain_allowed)
                
                if not is_allowed:
                    violations.append({
                        'type': 'pattern_contamination',
                        'pattern': description,
                        'severity': 'high',
                        'message': f"Contamination pattern detected: {description}"
                    })
        
        # Check 4: Domain boundary violations
        domain_blocked = self.DOMAIN_BOUNDARIES.get(current_domain, {}).get('blocked', [])
        for blocked_term in domain_blocked:
            if blocked_term in content_lower:
                violations.append({
                    'type': 'domain_violation',
                    'term': blocked_term,
                    'severity': 'high',
                    'message': f"Domain-inappropriate term '{blocked_term}' found in {current_domain} proposal"
                })
        
        # Check 5: Generic language that suggests copy-paste
        generic_phrases = self._detect_generic_language(content)
        if len(generic_phrases) > 3:
            warnings.append({
                'type': 'generic_language',
                'phrases': generic_phrases[:5],
                'severity': 'medium',
                'message': f"Content appears too generic with {len(generic_phrases)} boilerplate phrases"
            })
        
        # Calculate severity score
        critical_count = sum(1 for v in violations if v['severity'] == 'critical')
        high_count = sum(1 for v in violations if v['severity'] == 'high')
        
        is_valid = len(violations) == 0
        requires_regeneration = critical_count > 0 or high_count >= 2
        
        return {
            'valid': is_valid,
            'violations': violations,
            'warnings': warnings,
            'requires_regeneration': requires_regeneration,
            'contamination_score': len(violations) + len(warnings) * 0.5,
            'recommendations': self._generate_recommendations(violations, warnings, current_domain)
        }
    
    def _detect_generic_language(self, content: str) -> List[str]:
        """Detect generic boilerplate language."""
        generic_patterns = [
            'leveraging our expertise',
            'state-of-the-art',
            'cutting-edge',
            'world-class',
            'best-in-class',
            'seamlessly integrate',
            'robust solution',
            'comprehensive approach',
            'holistic framework',
            'synergistic',
            'paradigm shift',
            'game-changing',
            'revolutionary',
            'next-generation',
            'innovative solution'
        ]
        
        found = []
        content_lower = content.lower()
        for phrase in generic_patterns:
            if phrase in content_lower:
                found.append(phrase)
        
        return found
    
    def _generate_recommendations(
        self,
        violations: List[Dict],
        warnings: List[Dict],
        domain: str
    ) -> List[str]:
        """Generate actionable recommendations based on violations."""
        recommendations = []
        
        # Group violations by type
        client_violations = [v for v in violations if v['type'] == 'client_contamination']
        domain_violations = [v for v in violations if v['type'] == 'domain_violation']
        pattern_violations = [v for v in violations if v['type'] == 'pattern_contamination']
        
        if client_violations:
            recommendations.append(
                f"Remove all references to other clients: {', '.join(v['term'] for v in client_violations)}"
            )
        
        if domain_violations:
            recommendations.append(
                f"Remove terms inappropriate for {domain} domain: {', '.join(v['term'] for v in domain_violations)}"
            )
        
        if pattern_violations:
            recommendations.append(
                "Review content for copy-paste from other proposals"
            )
        
        generic_warnings = [w for w in warnings if w['type'] == 'generic_language']
        if generic_warnings:
            recommendations.append(
                "Replace generic marketing language with client-specific value statements"
            )
        
        if not recommendations:
            recommendations.append("Content passes isolation checks")
        
        return recommendations
    
    def clean_content(
        self,
        content: str,
        client_context: Dict[str, Any]
    ) -> Tuple[str, List[str]]:
        """
        Attempt to clean contaminated content.
        
        NOTE: This is a best-effort cleanup. Severe contamination 
        should trigger full regeneration instead.
        
        Args:
            content: Content to clean
            client_context: Client context
            
        Returns:
            Tuple of (cleaned_content, changes_made)
        """
        changes = []
        cleaned = content
        
        forbidden = client_context.get('forbidden_references', [])
        
        # Remove forbidden references
        for ref in forbidden:
            pattern = re.compile(re.escape(ref), re.IGNORECASE)
            if pattern.search(cleaned):
                cleaned = pattern.sub('[REDACTED]', cleaned)
                changes.append(f"Removed reference to '{ref}'")
        
        # Remove other client names
        current_client = client_context.get('client_name', '').lower()
        for client in self.KNOWN_CLIENTS:
            if client not in current_client:
                pattern = re.compile(re.escape(client), re.IGNORECASE)
                if pattern.search(cleaned):
                    cleaned = pattern.sub('[CLIENT]', cleaned)
                    changes.append(f"Removed reference to '{client}'")
        
        return cleaned, changes
    
    def validate_section(
        self,
        section_content: str,
        section_type: str,
        client_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate a specific section with section-type awareness.
        
        Some sections have stricter requirements than others.
        """
        # Sections that must be heavily client-specific
        strict_sections = ['executive_summary', 'understanding', 'proposed_solution', 'technical_approach']
        
        # Run base validation
        result = self.validate_content(section_content, client_context)
        
        # Add section-specific checks
        if section_type in strict_sections:
            client_name = client_context.get('client_name', '')
            
            # Check if client name appears
            if client_name and client_name.lower() not in section_content.lower():
                result['warnings'].append({
                    'type': 'missing_client_name',
                    'severity': 'medium',
                    'message': f"Client name '{client_name}' should appear in {section_type}"
                })
            
            # Check for domain terminology
            domain = client_context.get('domain', 'enterprise')
            domain_allowed = self.DOMAIN_BOUNDARIES.get(domain, {}).get('allowed', [])
            
            domain_term_count = sum(1 for term in domain_allowed if term in section_content.lower())
            if domain_term_count < 2:
                result['warnings'].append({
                    'type': 'weak_domain_alignment',
                    'severity': 'medium',
                    'message': f"Section lacks domain-specific terminology for {domain}"
                })
        
        return result


def get_context_isolation_agent(org_id: int = None) -> ContextIsolationAgent:
    """Factory function to get Context Isolation Agent."""
    return ContextIsolationAgent(org_id=org_id)
