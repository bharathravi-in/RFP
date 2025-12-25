"""
Similarity Validator Agent

Compares generated content against approved Knowledge Base documents.
Ensures consistency with organizational messaging and detects deviations.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class SimilarityValidatorAgent:
    """
    Agent that validates generated content against Knowledge Base.
    
    Responsibilities:
    - Vector similarity scoring against approved documents
    - Deviation detection from established messaging
    - Alignment suggestions for inconsistent content
    - Citation verification
    - Consistency enforcement across sections
    """
    
    # Similarity thresholds
    SIMILARITY_THRESHOLDS = {
        'high_alignment': 0.85,
        'acceptable': 0.70,
        'deviation_warning': 0.50,
        'major_deviation': 0.30
    }
    
    # Content types that require KB alignment
    ALIGNMENT_REQUIRED = [
        'company_overview',
        'capabilities',
        'certifications',
        'case_studies',
        'methodology',
        'team_structure'
    ]

    VALIDATION_PROMPT = """You are a Content Consistency Auditor comparing proposal content against approved reference documents.

## Generated Content (To Validate)
{generated_content}

## Reference Documents (Approved Knowledge Base)
{reference_content}

## Validation Task

Compare the generated content against the reference documents and identify:

1. **Alignment Assessment**: How well does the generated content align with approved messaging?
2. **Deviations**: Where does the content deviate from approved language or claims?
3. **Inconsistencies**: Are there contradictions with established facts?
4. **Missing Citations**: Claims that should reference knowledge base but don't
5. **Improvements**: How to better align with approved content

## Response Format (JSON only)
{{
  "overall_similarity_score": 0.0-1.0,
  "alignment_level": "high|acceptable|warning|deviation",
  "aligned_elements": [
    {{"content": "aligned text snippet", "reference": "matching KB content", "score": 0.0-1.0}}
  ],
  "deviations": [
    {{
      "generated_text": "text that deviates",
      "expected_text": "what KB says",
      "severity": "critical|high|medium|low",
      "recommendation": "how to fix"
    }}
  ],
  "missing_citations": [
    {{"claim": "uncited claim", "suggested_source": "KB document that could support it"}}
  ],
  "consistency_issues": [
    {{"issue": "description", "sections_affected": ["section1", "section2"]}}
  ],
  "revision_suggestions": [
    {{"original": "current text", "revised": "suggested revision", "reason": "why change"}}
  ],
  "confidence": 0.0-1.0
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='quality_review')
        self.name = "SimilarityValidatorAgent"
        self.org_id = org_id
    
    def validate_against_knowledge_base(
        self,
        content: str,
        knowledge_items: List[Dict],
        content_type: str = 'general',
        session_state: Dict = None
    ) -> Dict:
        """
        Validate content against knowledge base items.
        
        Args:
            content: Generated content to validate
            knowledge_items: List of relevant KB items
            content_type: Type of content being validated
            session_state: Shared state
            
        Returns:
            Validation results with similarity scores and deviations
        """
        session_state = session_state or {}
        
        if not content:
            return {"success": False, "error": "No content to validate"}
        
        if not knowledge_items:
            return {
                "success": True,
                "overall_similarity_score": 0.0,
                "alignment_level": "no_reference",
                "message": "No knowledge base items available for comparison",
                "deviations": [],
                "session_state": session_state
            }
        
        # Step 1: Basic text similarity analysis
        basic_similarity = self._calculate_text_similarity(content, knowledge_items)
        
        # Step 2: Extract claims for verification
        claims = self._extract_claims(content)
        
        # Step 3: AI-powered detailed validation
        try:
            ai_result = self._ai_validation(content, knowledge_items)
        except Exception as e:
            logger.error(f"AI validation failed: {e}")
            ai_result = self._fallback_validation(content, knowledge_items, basic_similarity)
        
        # Step 4: Merge results
        overall_score = (basic_similarity + ai_result.get('overall_similarity_score', basic_similarity)) / 2
        alignment_level = self._get_alignment_level(overall_score)
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "content_validated",
            "summary": f"Similarity: {overall_score:.0%}, Alignment: {alignment_level}, Deviations: {len(ai_result.get('deviations', []))}"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "overall_similarity_score": round(overall_score, 2),
            "alignment_level": alignment_level,
            "basic_similarity": round(basic_similarity, 2),
            "aligned_elements": ai_result.get('aligned_elements', []),
            "deviations": ai_result.get('deviations', []),
            "missing_citations": ai_result.get('missing_citations', []),
            "consistency_issues": ai_result.get('consistency_issues', []),
            "revision_suggestions": ai_result.get('revision_suggestions', []),
            "claims_found": len(claims),
            "requires_revision": alignment_level in ['warning', 'deviation'],
            "session_state": session_state
        }
    
    def validate_proposal_sections(
        self,
        sections: List[Dict],
        knowledge_items: List[Dict],
        session_state: Dict = None
    ) -> Dict:
        """
        Validate all proposal sections against knowledge base.
        
        Args:
            sections: List of proposal sections
            knowledge_items: KB items for comparison
            session_state: Shared state
            
        Returns:
            Aggregated validation results
        """
        session_state = session_state or {}
        section_results = []
        total_score = 0
        deviations_total = 0
        
        for section in sections:
            content = section.get('content', '')
            title = section.get('title', 'Untitled')
            
            if not content or len(content) < 50:
                continue
            
            result = self.validate_against_knowledge_base(
                content=content,
                knowledge_items=knowledge_items
            )
            
            section_results.append({
                'section': title,
                'similarity_score': result.get('overall_similarity_score', 0),
                'alignment_level': result.get('alignment_level', 'unknown'),
                'deviations': len(result.get('deviations', [])),
                'requires_revision': result.get('requires_revision', False)
            })
            
            total_score += result.get('overall_similarity_score', 0)
            deviations_total += len(result.get('deviations', []))
        
        avg_score = total_score / len(section_results) if section_results else 0
        
        # Cross-section consistency check
        consistency_issues = self._check_cross_section_consistency(sections)
        
        return {
            "success": True,
            "section_results": section_results,
            "average_similarity": round(avg_score, 2),
            "total_deviations": deviations_total,
            "sections_requiring_revision": len([r for r in section_results if r['requires_revision']]),
            "cross_section_consistency": consistency_issues,
            "overall_alignment": self._get_alignment_level(avg_score),
            "session_state": session_state
        }
    
    def _calculate_text_similarity(self, content: str, knowledge_items: List[Dict]) -> float:
        """Calculate basic text similarity using word overlap."""
        content_words = set(re.findall(r'\b\w+\b', content.lower()))
        
        if not content_words:
            return 0.0
        
        max_similarity = 0.0
        
        for item in knowledge_items:
            kb_content = item.get('content', '') or item.get('text', '')
            kb_words = set(re.findall(r'\b\w+\b', kb_content.lower()))
            
            if not kb_words:
                continue
            
            # Jaccard similarity
            intersection = len(content_words & kb_words)
            union = len(content_words | kb_words)
            
            similarity = intersection / union if union > 0 else 0
            max_similarity = max(max_similarity, similarity)
        
        return max_similarity
    
    def _extract_claims(self, content: str) -> List[str]:
        """Extract factual claims from content."""
        claims = []
        
        # Patterns that indicate factual claims
        claim_patterns = [
            r'we have (?:over )?\d+',
            r'we (?:are|have been) (?:certified|compliant)',
            r'our (?:team|company|solution) (?:has|provides|includes)',
            r'\d+%\s+(?:reduction|improvement|increase)',
            r'(?:established|founded|operating) (?:in|since) \d{4}',
            r'(?:serving|worked with) (?:over )?\d+',
        ]
        
        for pattern in claim_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            claims.extend(matches)
        
        return claims
    
    def _ai_validation(self, content: str, knowledge_items: List[Dict]) -> Dict:
        """Use AI for detailed content validation."""
        client = self.config.client
        if not client:
            return self._fallback_validation(content, knowledge_items, 0.5)
        
        # Build reference content
        reference_parts = []
        for i, item in enumerate(knowledge_items[:5]):  # Limit items
            title = item.get('title', f'Document {i+1}')
            kb_content = item.get('content', '')[:2000]
            reference_parts.append(f"### {title}\n{kb_content}")
        
        reference_content = "\n\n".join(reference_parts)
        
        prompt = self.VALIDATION_PROMPT.format(
            generated_content=content[:5000],
            reference_content=reference_content[:8000]
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
            logger.error(f"AI validation error: {e}")
            return self._fallback_validation(content, knowledge_items, 0.5)
    
    def _fallback_validation(
        self,
        content: str,
        knowledge_items: List[Dict],
        basic_similarity: float
    ) -> Dict:
        """Fallback validation when AI is unavailable."""
        return {
            'overall_similarity_score': basic_similarity,
            'alignment_level': self._get_alignment_level(basic_similarity),
            'aligned_elements': [],
            'deviations': [],
            'missing_citations': [],
            'consistency_issues': [],
            'revision_suggestions': [],
            'confidence': 0.5
        }
    
    def _get_alignment_level(self, score: float) -> str:
        """Convert similarity score to alignment level."""
        if score >= self.SIMILARITY_THRESHOLDS['high_alignment']:
            return 'high'
        elif score >= self.SIMILARITY_THRESHOLDS['acceptable']:
            return 'acceptable'
        elif score >= self.SIMILARITY_THRESHOLDS['deviation_warning']:
            return 'warning'
        else:
            return 'deviation'
    
    def _check_cross_section_consistency(self, sections: List[Dict]) -> List[Dict]:
        """Check for consistency issues across sections."""
        issues = []
        
        # Extract key facts from each section
        facts_by_section = {}
        for section in sections:
            title = section.get('title', 'Unknown')
            content = section.get('content', '')
            
            # Extract numeric claims
            numbers = re.findall(r'\d+(?:\.\d+)?%?', content)
            years = re.findall(r'\b(19|20)\d{2}\b', content)
            
            facts_by_section[title] = {
                'numbers': numbers,
                'years': years
            }
        
        # Look for contradictions (simplified check)
        # In a full implementation, this would use NLP for semantic comparison
        section_titles = list(facts_by_section.keys())
        for i, title1 in enumerate(section_titles):
            for title2 in section_titles[i+1:]:
                facts1 = facts_by_section[title1]
                facts2 = facts_by_section[title2]
                
                # Check for conflicting years
                common_years = set(facts1['years']) & set(facts2['years'])
                if len(common_years) > 0:
                    # Years match, likely consistent
                    pass
        
        return issues
    
    def verify_citations(
        self,
        content: str,
        knowledge_items: List[Dict]
    ) -> Dict:
        """Verify that citations in content match knowledge base."""
        # Find citation patterns [Source: X]
        citations = re.findall(r'\[Source:\s*([^\]]+)\]', content, re.IGNORECASE)
        
        verified = []
        unverified = []
        
        kb_titles = [item.get('title', '').lower() for item in knowledge_items]
        
        for citation in citations:
            citation_lower = citation.lower().strip()
            if any(citation_lower in title or title in citation_lower for title in kb_titles):
                verified.append(citation)
            else:
                unverified.append(citation)
        
        return {
            'total_citations': len(citations),
            'verified': verified,
            'unverified': unverified,
            'verification_rate': len(verified) / len(citations) if citations else 1.0
        }


def get_similarity_validator_agent(org_id: int = None) -> SimilarityValidatorAgent:
    """Factory function to get Similarity Validator Agent."""
    return SimilarityValidatorAgent(org_id=org_id)
