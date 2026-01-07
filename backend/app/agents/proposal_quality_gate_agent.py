"""
Proposal Quality Gate Agent

Final validation layer before proposal export.
Enforces quality thresholds, detects red flags, and triggers approval workflows.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class ProposalQualityGateAgent:
    """
    Final quality gate agent that validates proposals before client delivery.
    
    Responsibilities:
    - Completeness validation (all required sections present)
    - Quality threshold enforcement (minimum scores)
    - Red-flag detection (hallucinations, commitments, assumptions)
    - Executive readiness assessment
    - Approval workflow triggering
    """
    
    # Quality dimensions and weights
    QUALITY_DIMENSIONS = {
        'completeness': {'weight': 0.25, 'description': 'All required sections and content present'},
        'accuracy': {'weight': 0.25, 'description': 'Claims verified against knowledge base'},
        'clarity': {'weight': 0.20, 'description': 'Readability and understandability'},
        'relevance': {'weight': 0.15, 'description': 'Alignment with RFP requirements'},
        'tone': {'weight': 0.15, 'description': 'Executive-appropriate language'}
    }
    
    # Minimum thresholds
    QUALITY_THRESHOLDS = {
        'excellent': 0.85,
        'good': 0.70,
        'acceptable': 0.50,
        'poor': 0.0
    }
    
    # Required sections for completeness check
    REQUIRED_SECTIONS = [
        'executive_summary',
        'understanding',
        'proposed_solution',
        'implementation_approach',
        'team_resources',
        'timeline',
        'pricing',
        'why_choose_us'
    ]
    
    # Red flag patterns
    RED_FLAG_PATTERNS = {
        'unverified_claims': [
            r'we guarantee',
            r'100%\s+(?:uptime|availability|success)',
            r'zero\s+(?:downtime|failures|defects)',
            r'always\s+(?:available|responsive)',
        ],
        'binding_commitments': [
            r'we will\s+(?:definitely|certainly|absolutely)',
            r'we commit to',
            r'we promise',
            r'guaranteed\s+(?:delivery|success|results)',
        ],
        'assumptions': [
            r'we assume',
            r'assuming\s+that',
            r'it is assumed',
            r'based on the assumption',
        ],
        'competitor_mentions': [
            r'unlike\s+(?:competitor|other vendors)',
            r'better than\s+\w+',
            r'compared to\s+(?:competitor|\w+\s+Inc)',
        ],
        'vague_language': [
            r'various\s+(?:solutions|options)',
            r'many\s+(?:features|capabilities)',
            r'etc\.?\s*$',
            r'and so on',
            r'things like',
        ]
    }

    # Minimum word counts per section
    MINIMUM_WORD_COUNTS = {
        'executive_summary': 200,
        'understanding': 150,
        'proposed_solution': 300,
        'implementation_approach': 250,
        'team_resources': 150,
        'timeline': 100,
        'pricing': 100,
        'why_choose_us': 150
    }
    
    VALIDATION_PROMPT = """You are an Enterprise Proposal Quality Auditor reviewing a proposal before client submission.

## Proposal Content
{proposal_content}

## Validation Requirements

Evaluate this proposal on the following dimensions (score 0.0-1.0 each):

1. **Completeness** (25%): Are all required sections present with adequate depth?
2. **Accuracy** (25%): Are claims specific and verifiable? Any hallucinations?
3. **Clarity** (20%): Is the language clear, professional, and readable?
4. **Relevance** (15%): Does content directly address the RFP requirements?
5. **Tone** (15%): Is the language executive-appropriate and confident?

## Response Format (JSON only)
{{
  "dimension_scores": {{
    "completeness": 0.0-1.0,
    "accuracy": 0.0-1.0,
    "clarity": 0.0-1.0,
    "relevance": 0.0-1.0,
    "tone": 0.0-1.0
  }},
  "overall_score": 0.0-1.0,
  "quality_level": "excellent|good|acceptable|poor",
  "red_flags": [
    {{"type": "flag_type", "text": "problematic text", "severity": "critical|high|medium|low", "suggestion": "how to fix"}}
  ],
  "missing_elements": ["list of missing required elements"],
  "weak_sections": [
    {{"section": "section_name", "issue": "what's wrong", "recommendation": "how to improve"}}
  ],
  "executive_readiness": {{
    "ready": true/false,
    "blockers": ["list of issues blocking executive approval"],
    "recommendations": ["list of improvements needed"]
  }},
  "approval_recommendation": "approve|revise|reject",
  "revision_priority": ["ordered list of sections to revise first"]
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='quality_review')
        self.name = "ProposalQualityGateAgent"
        self.org_id = org_id
    
    def validate_proposal(
        self,
        sections: List[Dict],
        answers: List[Dict] = None,
        session_state: Dict = None
    ) -> Dict:
        """
        Perform comprehensive proposal validation.
        
        Args:
            sections: List of proposal sections with content
            answers: Optional list of Q&A items
            session_state: Shared state
            
        Returns:
            Validation results with scores, flags, and recommendations
        """
        session_state = session_state or {}
        
        if not sections:
            return {"success": False, "error": "No sections to validate"}
        
        # Step 1: Basic completeness validation
        completeness_result = self._check_completeness(sections)
        
        # Step 2: Red flag detection
        red_flags = self._detect_red_flags(sections)
        
        # Step 3: Word count validation
        depth_issues = self._check_section_depth(sections)
        
        # Step 4: AI-powered quality assessment
        try:
            ai_assessment = self._ai_quality_assessment(sections)
        except Exception as e:
            logger.error(f"AI assessment failed: {e}")
            ai_assessment = self._fallback_assessment(sections, completeness_result, red_flags)
        
        # Step 5: Calculate overall quality
        overall_score = self._calculate_overall_score(
            completeness_result,
            ai_assessment,
            red_flags,
            depth_issues
        )
        
        # Step 6: Determine approval recommendation
        approval = self._determine_approval(overall_score, red_flags, completeness_result)
        
        # Store in session state
        session_state["quality_gate_result"] = {
            "score": overall_score,
            "approval": approval,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "proposal_validated",
            "summary": f"Quality score: {overall_score:.0%}, Recommendation: {approval}"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "overall_score": round(overall_score, 2),
            "quality_level": self._get_quality_level(overall_score),
            "dimension_scores": ai_assessment.get("dimension_scores", {}),
            "completeness": completeness_result,
            "red_flags": red_flags,
            "depth_issues": depth_issues,
            "weak_sections": ai_assessment.get("weak_sections", []),
            "executive_readiness": ai_assessment.get("executive_readiness", {}),
            "approval_recommendation": approval,
            "revision_priority": ai_assessment.get("revision_priority", []),
            "session_state": session_state
        }
    
    def _check_completeness(self, sections: List[Dict]) -> Dict:
        """Check if all required sections are present."""
        section_slugs = set()
        for section in sections:
            section_type = section.get('section_type', {})
            if isinstance(section_type, dict):
                slug = section_type.get('slug', '')
            else:
                slug = str(section_type)
            section_slugs.add(slug.lower())
            
            # Also check title-based matching
            title = section.get('title', '').lower().replace(' ', '_')
            section_slugs.add(title)
        
        missing = []
        present = []
        for required in self.REQUIRED_SECTIONS:
            # Flexible matching
            found = False
            for slug in section_slugs:
                if required in slug or slug in required:
                    found = True
                    break
            
            if found:
                present.append(required)
            else:
                missing.append(required)
        
        completeness_score = len(present) / len(self.REQUIRED_SECTIONS) if self.REQUIRED_SECTIONS else 1.0
        
        return {
            "score": completeness_score,
            "present": present,
            "missing": missing,
            "total_required": len(self.REQUIRED_SECTIONS),
            "total_present": len(present)
        }
    
    def _detect_red_flags(self, sections: List[Dict]) -> List[Dict]:
        """Detect red flag patterns in proposal content."""
        red_flags = []
        
        for section in sections:
            content = section.get('content', '')
            section_title = section.get('title', 'Unknown Section')
            
            for flag_type, patterns in self.RED_FLAG_PATTERNS.items():
                for pattern in patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        # Determine severity
                        if flag_type in ['unverified_claims', 'binding_commitments']:
                            severity = 'critical'
                        elif flag_type in ['assumptions', 'competitor_mentions']:
                            severity = 'high'
                        else:
                            severity = 'medium'
                        
                        red_flags.append({
                            "type": flag_type,
                            "section": section_title,
                            "text": match.group(0),
                            "context": content[max(0, match.start()-50):match.end()+50],
                            "severity": severity,
                            "suggestion": self._get_flag_suggestion(flag_type)
                        })
        
        return red_flags
    
    def _get_flag_suggestion(self, flag_type: str) -> str:
        """Get suggestion for fixing a red flag."""
        suggestions = {
            'unverified_claims': 'Replace with specific, verifiable metrics from documented capabilities',
            'binding_commitments': 'Soften language to indicate capability rather than guarantee',
            'assumptions': 'Move to dedicated Assumptions section or validate with client',
            'competitor_mentions': 'Remove competitor references; focus on own capabilities',
            'vague_language': 'Replace with specific details and concrete examples'
        }
        return suggestions.get(flag_type, 'Review and revise as appropriate')
    
    def _check_section_depth(self, sections: List[Dict]) -> List[Dict]:
        """Check if sections have adequate depth."""
        issues = []
        
        for section in sections:
            content = section.get('content', '')
            title = section.get('title', 'Unknown')
            word_count = len(content.split())
            
            # Find matching minimum requirement
            section_type = section.get('section_type', {})
            slug = section_type.get('slug', '') if isinstance(section_type, dict) else ''
            
            for key, minimum in self.MINIMUM_WORD_COUNTS.items():
                if key in slug.lower() or key in title.lower().replace(' ', '_'):
                    if word_count < minimum:
                        issues.append({
                            "section": title,
                            "current_words": word_count,
                            "minimum_required": minimum,
                            "deficit": minimum - word_count,
                            "severity": "high" if word_count < minimum * 0.5 else "medium"
                        })
                    break
        
        return issues
    
    def _ai_quality_assessment(self, sections: List[Dict]) -> Dict:
        """Use AI to assess overall quality."""
        client = self.config.client
        if not client:
            return self._fallback_assessment(sections, {}, [])
        
        # Build proposal content summary
        content_parts = []
        for section in sections[:10]:  # Limit sections
            title = section.get('title', 'Untitled')
            content = section.get('content', '')[:2000]  # Limit content
            content_parts.append(f"## {title}\n{content}")
        
        proposal_content = "\n\n".join(content_parts)
        prompt = self.VALIDATION_PROMPT.format(proposal_content=proposal_content[:15000])
        
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
            logger.error(f"AI quality assessment error: {e}")
            return self._fallback_assessment(sections, {}, [])
    
    def _fallback_assessment(
        self,
        sections: List[Dict],
        completeness: Dict,
        red_flags: List[Dict]
    ) -> Dict:
        """Fallback assessment when AI is unavailable."""
        # Calculate basic scores
        completeness_score = completeness.get('score', 0.5) if completeness else 0.5
        red_flag_penalty = min(len(red_flags) * 0.1, 0.5)
        
        # Estimate other dimensions
        total_words = sum(len(s.get('content', '').split()) for s in sections)
        clarity_score = min(1.0, total_words / 2000) if total_words > 0 else 0.3
        
        return {
            "dimension_scores": {
                "completeness": completeness_score,
                "accuracy": 0.6 - red_flag_penalty,
                "clarity": clarity_score,
                "relevance": 0.6,
                "tone": 0.6
            },
            "overall_score": (completeness_score + 0.6 - red_flag_penalty + clarity_score + 0.6 + 0.6) / 5,
            "quality_level": "acceptable",
            "red_flags": [],
            "missing_elements": [],
            "weak_sections": [],
            "executive_readiness": {
                "ready": red_flag_penalty < 0.2,
                "blockers": ["AI assessment unavailable - manual review required"],
                "recommendations": ["Complete manual quality review"]
            },
            "approval_recommendation": "revise",
            "revision_priority": []
        }
    
    def _calculate_overall_score(
        self,
        completeness: Dict,
        ai_assessment: Dict,
        red_flags: List[Dict],
        depth_issues: List[Dict]
    ) -> float:
        """Calculate weighted overall quality score."""
        # Start with AI assessment if available
        if 'overall_score' in ai_assessment:
            base_score = ai_assessment['overall_score']
        else:
            # Calculate from dimensions
            dimension_scores = ai_assessment.get('dimension_scores', {})
            if dimension_scores:
                weighted_sum = sum(
                    dimension_scores.get(dim, 0.5) * info['weight']
                    for dim, info in self.QUALITY_DIMENSIONS.items()
                )
                base_score = weighted_sum
            else:
                base_score = 0.5
        
        # Apply penalties
        critical_flags = len([f for f in red_flags if f.get('severity') == 'critical'])
        high_flags = len([f for f in red_flags if f.get('severity') == 'high'])
        
        penalty = (critical_flags * 0.15) + (high_flags * 0.05) + (len(depth_issues) * 0.03)
        
        # Ensure completeness is weighted
        completeness_factor = completeness.get('score', 1.0)
        
        final_score = max(0.0, min(1.0, base_score * completeness_factor - penalty))
        
        return final_score
    
    def _get_quality_level(self, score: float) -> str:
        """Convert score to quality level."""
        if score >= self.QUALITY_THRESHOLDS['excellent']:
            return 'excellent'
        elif score >= self.QUALITY_THRESHOLDS['good']:
            return 'good'
        elif score >= self.QUALITY_THRESHOLDS['acceptable']:
            return 'acceptable'
        else:
            return 'poor'
    
    def _determine_approval(
        self,
        score: float,
        red_flags: List[Dict],
        completeness: Dict
    ) -> str:
        """Determine approval recommendation."""
        critical_flags = len([f for f in red_flags if f.get('severity') == 'critical'])
        missing_sections = len(completeness.get('missing', []))
        
        # Auto-reject conditions
        if critical_flags > 0:
            return 'reject'
        if missing_sections > 2:
            return 'reject'
        if score < self.QUALITY_THRESHOLDS['acceptable']:
            return 'reject'
        
        # Auto-approve conditions
        if score >= self.QUALITY_THRESHOLDS['excellent'] and not red_flags:
            return 'approve'
        
        # Default to revise
        return 'revise'
    
    def get_revision_instructions(
        self,
        validation_result: Dict
    ) -> List[Dict]:
        """Generate specific revision instructions based on validation."""
        instructions = []
        
        # Address missing sections
        for section in validation_result.get('completeness', {}).get('missing', []):
            instructions.append({
                "priority": 1,
                "type": "add_section",
                "section": section,
                "instruction": f"Add required section: {section.replace('_', ' ').title()}"
            })
        
        # Address red flags
        for flag in validation_result.get('red_flags', []):
            instructions.append({
                "priority": 2 if flag.get('severity') == 'critical' else 3,
                "type": "fix_red_flag",
                "section": flag.get('section'),
                "text": flag.get('text'),
                "instruction": flag.get('suggestion')
            })
        
        # Address depth issues
        for issue in validation_result.get('depth_issues', []):
            instructions.append({
                "priority": 4,
                "type": "expand_section",
                "section": issue.get('section'),
                "instruction": f"Expand content by approximately {issue.get('deficit', 0)} words"
            })
        
        # Sort by priority
        instructions.sort(key=lambda x: x['priority'])
        
        return instructions


def get_proposal_quality_gate_agent(org_id: int = None) -> ProposalQualityGateAgent:
    """Factory function to get Proposal Quality Gate Agent."""
    return ProposalQualityGateAgent(org_id=org_id)
