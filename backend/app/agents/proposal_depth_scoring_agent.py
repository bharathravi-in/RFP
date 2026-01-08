"""
Proposal Depth Scoring Agent

Quantifies the "heaviness" of proposal content to ensure quality.
Triggers regeneration for sections that don't meet quality thresholds.

Scoring Dimensions:
- Client Specificity: References to client's actual problem
- Evidence Density: Architecture, metrics, delivery methods  
- Risk Ownership: Explicit risk acknowledgement
- Internal Consistency: Cross-section references
- Decision Usefulness: Actionable for evaluators

Sections scoring below threshold (default 4.0) trigger regeneration.
"""
import json
import logging
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class ProposalDepthScoringAgent:
    """
    Quality enforcement agent that scores content "depth" and triggers
    regeneration for low-quality sections.
    
    Features:
    - Multi-dimensional scoring (5 dimensions, 0-5 each)
    - Identifies specific issues per section
    - Provides improvement suggestions
    - Enforces regeneration threshold
    """
    
    SCORING_PROMPT = """You are a Senior Proposal Quality Reviewer evaluating content depth.

## Section to Evaluate:
Title: {section_title}
Content:
{section_content}

## Narrative Context (What this proposal SHOULD convey):
{narrative_context}

## Scoring Dimensions
Rate each dimension from 0-5:

1. **Client Specificity** (0-5)
   - 0: No client reference
   - 2: Generic mention
   - 5: Specific client problems/constraints referenced multiple times

2. **Evidence Density** (0-5)
   - 0: Pure claims, no evidence
   - 2: Some examples but generic
   - 5: Architecture, metrics, delivery methods, case studies

3. **Risk Ownership** (0-5)
   - 0: No risk mention
   - 2: Risks listed but not owned
   - 5: Risks acknowledged with specific mitigations

4. **Internal Consistency** (0-5)
   - 0: Standalone section
   - 2: Mentions other sections
   - 5: Clear references to solution thesis and value pillars

5. **Decision Usefulness** (0-5)
   - 0: Filler content
   - 2: Information but not actionable
   - 5: Clear, evaluator can make decision based on this

## Anti-Patterns to Flag:
- Generic enterprise phrases ("comprehensive solution", "seamless integration")
- Claims without evidence
- Content that could apply to any client
- AI-sounding over-polished language
- Empty adjectives ("robust", "innovative", "cutting-edge")

## Output Format
Return JSON:
{{
    "dimension_scores": {{
        "client_specificity": 0-5,
        "evidence_density": 0-5,
        "risk_ownership": 0-5,
        "internal_consistency": 0-5,
        "decision_usefulness": 0-5
    }},
    "overall_score": weighted_average,
    "issues": [
        {{
            "type": "missing_evidence|generic_content|no_client_reference|etc",
            "location": "paragraph number or quote",
            "suggestion": "How to fix"
        }}
    ],
    "anti_patterns_found": ["phrase1", "phrase2"],
    "regeneration_required": true/false,
    "improvement_priority": "high|medium|low",
    "specific_fixes": [
        "Add reference to client's offline-first constraint",
        "Include metric from similar deployment"
    ]
}}

Evaluate now:"""

    # Generic phrases that indicate low-quality content
    ANTI_PATTERN_PHRASES = [
        "comprehensive solution",
        "seamless integration", 
        "best-in-class",
        "robust platform",
        "cutting-edge technology",
        "state-of-the-art",
        "world-class",
        "industry-leading",
        "innovative approach",
        "holistic solution",
        "end-to-end",
        "leverage synergies",
        "digital transformation journey",
        "paradigm shift",
        "value-added",
        "scalable and flexible",
        "proven track record",
        "unique value proposition"
    ]
    
    # Weights for dimension scoring
    DIMENSION_WEIGHTS = {
        'client_specificity': 1.2,      # Most important
        'evidence_density': 1.2,         # Most important
        'risk_ownership': 1.0,
        'internal_consistency': 0.8,
        'decision_usefulness': 0.8
    }
    
    # Default threshold for regeneration
    DEFAULT_THRESHOLD = 4.0
    MAX_RETRIES = 3

    def __init__(self, org_id: int = None, threshold: float = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='depth_scoring')
        self.threshold = threshold or self.DEFAULT_THRESHOLD
        logger.info(f"ProposalDepthScoringAgent initialized with threshold: {self.threshold}")
    
    def score_section(
        self,
        section_title: str,
        section_content: str,
        narrative_context: Dict = None
    ) -> Dict[str, Any]:
        """
        Score a section's depth and quality.
        
        Args:
            section_title: Title of the section
            section_content: Content to evaluate
            narrative_context: The narrative context from ProposalNarrativeArchitectAgent
            
        Returns:
            Dict with scores, issues, and regeneration recommendation
        """
        try:
            # First, do rule-based anti-pattern detection
            rule_based_issues = self._detect_anti_patterns(section_content)
            
            # Build prompt
            prompt = self.SCORING_PROMPT.format(
                section_title=section_title,
                section_content=section_content[:4000],  # Limit content length
                narrative_context=json.dumps(narrative_context or {}, indent=2)[:2000]
            )
            
            logger.info(f"Scoring depth for section: {section_title}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.2,  # Low temp for consistent scoring
                max_tokens=2000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            if not result or not result.get('dimension_scores'):
                # Use rule-based fallback
                result = self._rule_based_scoring(section_content, narrative_context)
            
            # Merge rule-based anti-pattern findings
            if rule_based_issues:
                existing_patterns = result.get('anti_patterns_found', [])
                result['anti_patterns_found'] = list(set(existing_patterns + rule_based_issues))
            
            # Calculate overall score if not present
            if 'overall_score' not in result:
                result['overall_score'] = self._calculate_overall_score(result['dimension_scores'])
            
            # Determine regeneration requirement
            result['regeneration_required'] = result['overall_score'] < self.threshold
            result['threshold'] = self.threshold
            result['section_title'] = section_title
            
            return {
                'success': True,
                'scoring': result,
                'scored_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Depth scoring error: {str(e)}")
            # Return rule-based fallback
            result = self._rule_based_scoring(section_content, narrative_context)
            return {
                'success': True,
                'scoring': result,
                'scored_at': datetime.utcnow().isoformat(),
                'note': 'Rule-based scoring used'
            }
    
    def score_proposal(
        self,
        sections: List[Dict],
        narrative_context: Dict = None
    ) -> Dict[str, Any]:
        """
        Score entire proposal across all sections.
        
        Args:
            sections: List of sections with 'title' and 'content'
            narrative_context: Narrative context from architect
            
        Returns:
            Dict with per-section and aggregate scores
        """
        section_scores = []
        total_score = 0
        regeneration_needed = []
        
        for section in sections:
            score_result = self.score_section(
                section.get('title', 'Untitled'),
                section.get('content', ''),
                narrative_context
            )
            
            section_scores.append(score_result['scoring'])
            total_score += score_result['scoring'].get('overall_score', 0)
            
            if score_result['scoring'].get('regeneration_required'):
                regeneration_needed.append(section.get('title'))
        
        avg_score = total_score / len(sections) if sections else 0
        
        return {
            'success': True,
            'section_scores': section_scores,
            'aggregate_score': round(avg_score, 2),
            'sections_needing_regeneration': regeneration_needed,
            'proposal_passes_threshold': avg_score >= self.threshold,
            'threshold': self.threshold,
            'scored_at': datetime.utcnow().isoformat()
        }
    
    def _detect_anti_patterns(self, content: str) -> List[str]:
        """Detect generic/anti-pattern phrases in content."""
        content_lower = content.lower()
        found_patterns = []
        
        for pattern in self.ANTI_PATTERN_PHRASES:
            if pattern.lower() in content_lower:
                found_patterns.append(pattern)
        
        return found_patterns
    
    def _calculate_overall_score(self, dimension_scores: Dict) -> float:
        """Calculate weighted overall score."""
        total_weight = sum(self.DIMENSION_WEIGHTS.values())
        weighted_sum = 0
        
        for dim, weight in self.DIMENSION_WEIGHTS.items():
            score = dimension_scores.get(dim, 0)
            weighted_sum += score * weight
        
        return round(weighted_sum / total_weight, 2)
    
    def _rule_based_scoring(
        self,
        content: str,
        narrative_context: Dict = None
    ) -> Dict:
        """Fallback rule-based scoring when AI is unavailable."""
        scores = {
            'client_specificity': 2.5,
            'evidence_density': 2.5,
            'risk_ownership': 2.0,
            'internal_consistency': 2.5,
            'decision_usefulness': 2.5
        }
        
        issues = []
        content_lower = content.lower()
        
        # Check client specificity
        client_name = narrative_context.get('client_name', '') if narrative_context else ''
        if client_name and client_name.lower() in content_lower:
            scores['client_specificity'] = min(5, scores['client_specificity'] + 1.5)
        else:
            issues.append({
                'type': 'no_client_reference',
                'location': 'entire section',
                'suggestion': f'Add explicit reference to {client_name or "client"}'
            })
        
        # Check evidence density
        evidence_indicators = ['architecture', 'diagram', 'metric', '%', 'week', 'phase', 'delivered', 'implemented']
        evidence_count = sum(1 for indicator in evidence_indicators if indicator in content_lower)
        if evidence_count >= 3:
            scores['evidence_density'] = min(5, scores['evidence_density'] + 1.5)
        elif evidence_count == 0:
            issues.append({
                'type': 'missing_evidence',
                'location': 'entire section',
                'suggestion': 'Add specific metrics, architecture references, or delivery methods'
            })
        
        # Check risk ownership
        risk_indicators = ['risk', 'mitigation', 'contingency', 'challenge', 'constraint']
        risk_count = sum(1 for indicator in risk_indicators if indicator in content_lower)
        if risk_count >= 2:
            scores['risk_ownership'] = min(5, scores['risk_ownership'] + 1.5)
        
        # Check anti-patterns
        anti_patterns = self._detect_anti_patterns(content)
        if len(anti_patterns) > 3:
            scores['client_specificity'] = max(0, scores['client_specificity'] - 1)
            scores['evidence_density'] = max(0, scores['evidence_density'] - 1)
            issues.append({
                'type': 'generic_content',
                'location': 'multiple',
                'suggestion': f'Remove generic phrases: {", ".join(anti_patterns[:3])}'
            })
        
        # Content length check
        word_count = len(content.split())
        if word_count < 100:
            scores['decision_usefulness'] = max(0, scores['decision_usefulness'] - 1)
            issues.append({
                'type': 'insufficient_content',
                'location': 'entire section',
                'suggestion': 'Section is too brief to be useful for evaluators'
            })
        
        overall = self._calculate_overall_score(scores)
        
        return {
            'dimension_scores': scores,
            'overall_score': overall,
            'issues': issues,
            'anti_patterns_found': anti_patterns,
            'regeneration_required': overall < self.threshold,
            'improvement_priority': 'high' if overall < 3 else ('medium' if overall < 4 else 'low'),
            'specific_fixes': [issue['suggestion'] for issue in issues]
        }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract scoring JSON."""
        try:
            text = response_text.strip()
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1])
            text = text.strip()
            
            return json.loads(text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
            
            logger.warning("Could not parse scoring response")
            return {}
    
    def suggest_improvements(
        self,
        section_content: str,
        scoring_result: Dict
    ) -> List[str]:
        """
        Generate specific improvement suggestions based on scoring.
        
        Args:
            section_content: The content that was scored
            scoring_result: Result from score_section
            
        Returns:
            List of actionable improvement suggestions
        """
        suggestions = scoring_result.get('specific_fixes', []).copy()
        dimension_scores = scoring_result.get('dimension_scores', {})
        
        # Add dimension-specific suggestions
        if dimension_scores.get('client_specificity', 5) < 3:
            suggestions.append("Add 2-3 explicit references to the client's specific situation")
        
        if dimension_scores.get('evidence_density', 5) < 3:
            suggestions.append("Include at least one metric, architecture reference, or case study")
        
        if dimension_scores.get('risk_ownership', 5) < 3:
            suggestions.append("Acknowledge key risks and describe mitigation approach")
        
        if dimension_scores.get('internal_consistency', 5) < 3:
            suggestions.append("Reference the solution thesis or value pillars")
        
        if dimension_scores.get('decision_usefulness', 5) < 3:
            suggestions.append("Add clear recommendations or next steps for evaluators")
        
        return list(set(suggestions))  # Remove duplicates


def get_proposal_depth_scoring_agent(org_id: int = None, threshold: float = None) -> ProposalDepthScoringAgent:
    """Factory function to get Proposal Depth Scoring Agent."""
    return ProposalDepthScoringAgent(org_id=org_id, threshold=threshold)
