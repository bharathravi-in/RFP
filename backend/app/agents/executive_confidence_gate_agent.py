"""
Executive Confidence Gate Agent

The FINAL quality gate that asks: "Would a CXO trust this document in 10 minutes?"

This agent runs after all content is generated and provides a final
go/no-go assessment from an executive perspective.

Key Checks:
1. Can I explain the solution in 3 bullets?
2. Do I know why this vendor is safe?
3. Do risks feel acknowledged?
4. Do I know what happens next?

If checks fail, triggers regeneration of executive sections.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class ExecutiveConfidenceGateAgent:
    """
    Final gate agent that evaluates proposal from a CXO perspective.
    
    This agent simulates how a busy executive would evaluate the proposal
    in a 10-minute read-through. If the proposal doesn't pass executive
    scrutiny, it triggers regeneration of key sections.
    
    Features:
    - Executive summary clarity check
    - Trust signal validation
    - Risk acknowledgement verification
    - Next steps clarity assessment
    - 3-bullet explainability test
    """
    
    GATE_PROMPT = """You are a Chief Procurement Officer evaluating a proposal from {vendor_name} for {client_name}.

You have 10 minutes to decide if this proposal deserves serious consideration.

## Proposal Summary:
{proposal_summary}

## Executive Summary:
{executive_summary}

## Key Sections Overview:
{sections_overview}

## Your Evaluation Criteria

Answer these questions honestly (Yes/No/Partial):

1. **Can I explain this solution in 3 bullets?**
   - Is it clear what they're proposing?
   - Could I summarize this to my board?

2. **Do I know why {vendor_name} is safe?**
   - Track record visible?
   - Team credibility established?
   - Financial/delivery risk addressed?

3. **Do risks feel acknowledged?**
   - Did they mention realistic challenges?
   - Do mitigations feel genuine (not marketing)?
   
4. **Do I know what happens next?**
   - Clear timeline?
   - Obvious first step?
   - Who to contact?

5. **Does this feel like it was written FOR us?**
   - {client_name} mentioned appropriately?
   - Our constraints understood?
   - Not a generic template?

6. **Would I bring this to my leadership team?**
   - Professional enough?
   - Compelling enough?
   - Differentiated enough?

## Output Format
Return JSON:
{{
    "executive_ready": true/false,
    "trust_score": 0-10,
    "checklist": {{
        "explainable_in_3_bullets": true/false,
        "three_bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
        "vendor_safety_established": true/false,
        "risks_acknowledged": true/false,
        "next_steps_clear": true/false,
        "client_specific": true/false,
        "leadership_ready": true/false
    }},
    "gaps": [
        "Specific gap 1",
        "Specific gap 2"
    ],
    "strengths": [
        "What's working well"
    ],
    "executive_summary_rewrite_needed": true/false,
    "sections_needing_attention": ["Section names"],
    "verdict": "approve|revise|reject",
    "verdict_reason": "1-2 sentence explanation"
}}

Evaluate now with executive skepticism:"""

    # Trust score threshold for approval
    TRUST_THRESHOLD = 7.0
    
    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='executive_gate')
        logger.info(f"ExecutiveConfidenceGateAgent initialized")
    
    def evaluate_proposal(
        self,
        proposal_summary: str,
        executive_summary: str,
        sections: List[Dict],
        narrative_context: Dict = None,
        vendor_name: str = "Our Company"
    ) -> Dict[str, Any]:
        """
        Final gate evaluation of the complete proposal.
        
        Args:
            proposal_summary: Brief proposal overview
            executive_summary: The executive summary section
            sections: All proposal sections with title and content
            narrative_context: Narrative context from architect
            vendor_name: Our company name
            
        Returns:
            Dict with executive evaluation and recommendations
        """
        try:
            client_name = narrative_context.get('client_name', 'Client') if narrative_context else 'Client'
            
            # Build sections overview
            sections_overview = self._build_sections_overview(sections)
            
            prompt = self.GATE_PROMPT.format(
                vendor_name=vendor_name,
                client_name=client_name,
                proposal_summary=proposal_summary[:1500],
                executive_summary=executive_summary[:2000],
                sections_overview=sections_overview[:2000]
            )
            
            logger.info(f"Running executive confidence gate for {client_name}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.3,
                max_tokens=2000
            )
            
            result = self._parse_response(response_text)
            
            if not result or 'executive_ready' not in result:
                result = self._rule_based_evaluation(
                    executive_summary, sections, narrative_context
                )
            
            # Ensure trust score makes sense
            if result.get('trust_score', 0) >= self.TRUST_THRESHOLD:
                result['executive_ready'] = True
            elif result.get('trust_score', 0) < self.TRUST_THRESHOLD - 2:
                result['executive_ready'] = False
            
            return {
                'success': True,
                'evaluation': result,
                'threshold': self.TRUST_THRESHOLD,
                'evaluated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Executive gate evaluation error: {str(e)}")
            result = self._rule_based_evaluation(
                executive_summary, sections, narrative_context
            )
            return {
                'success': True,
                'evaluation': result,
                'evaluated_at': datetime.utcnow().isoformat(),
                'note': 'Rule-based evaluation used'
            }
    
    def _build_sections_overview(self, sections: List[Dict]) -> str:
        """Build a brief overview of all sections."""
        overview_parts = []
        for section in sections[:10]:  # Top 10 sections
            title = section.get('title', 'Untitled')
            content = section.get('content', '')
            # First 200 chars of each section
            preview = content[:200].replace('\n', ' ').strip()
            overview_parts.append(f"**{title}**: {preview}...")
        return '\n\n'.join(overview_parts)
    
    def _rule_based_evaluation(
        self,
        executive_summary: str,
        sections: List[Dict],
        narrative_context: Dict = None
    ) -> Dict:
        """Fallback rule-based evaluation."""
        client_name = narrative_context.get('client_name', '') if narrative_context else ''
        
        checklist = {
            'explainable_in_3_bullets': True,
            'three_bullets': [
                "Proposed solution and approach",
                "Key differentiators",
                "Implementation timeline"
            ],
            'vendor_safety_established': True,
            'risks_acknowledged': False,
            'next_steps_clear': False,
            'client_specific': False,
            'leadership_ready': True
        }
        
        gaps = []
        strengths = []
        trust_score = 6.0  # Start at moderate
        
        exec_lower = executive_summary.lower()
        
        # Check client specificity
        if client_name and client_name.lower() in exec_lower:
            checklist['client_specific'] = True
            trust_score += 0.5
            strengths.append("Client name referenced in executive summary")
        else:
            gaps.append("Executive summary doesn't mention client by name")
            trust_score -= 0.5
        
        # Check for risk acknowledgement
        if any(word in exec_lower for word in ['risk', 'challenge', 'constraint', 'mitigation']):
            checklist['risks_acknowledged'] = True
            trust_score += 0.5
            strengths.append("Risks acknowledged in executive summary")
        else:
            gaps.append("No risk acknowledgement visible")
            trust_score -= 0.5
        
        # Check for next steps
        if any(word in exec_lower for word in ['next step', 'kickoff', 'timeline', 'contact', 'begin', 'start']):
            checklist['next_steps_clear'] = True
            trust_score += 0.5
            strengths.append("Clear call to action present")
        else:
            gaps.append("Next steps not clearly stated")
        
        # Check sections for completeness
        section_titles = [s.get('title', '').lower() for s in sections]
        
        required_sections = ['executive summary', 'approach', 'team', 'timeline', 'pricing']
        missing_sections = [s for s in required_sections if not any(s in title for title in section_titles)]
        
        if missing_sections:
            gaps.append(f"Missing key sections: {', '.join(missing_sections)}")
            trust_score -= len(missing_sections) * 0.3
        else:
            strengths.append("All key proposal sections present")
            trust_score += 0.5
        
        # Word count check for executive summary
        word_count = len(executive_summary.split())
        if word_count < 200:
            gaps.append("Executive summary too brief")
            trust_score -= 0.5
        elif word_count > 1000:
            gaps.append("Executive summary too long for quick read")
        else:
            strengths.append("Executive summary is well-sized")
        
        # Determine verdict
        trust_score = max(0, min(10, trust_score))  # Clamp to 0-10
        
        if trust_score >= self.TRUST_THRESHOLD:
            verdict = "approve"
            verdict_reason = "Proposal meets executive expectations for consideration"
        elif trust_score >= self.TRUST_THRESHOLD - 2:
            verdict = "revise"
            verdict_reason = f"Proposal needs improvement: {', '.join(gaps[:2])}"
        else:
            verdict = "reject"
            verdict_reason = f"Proposal not ready for executive review: {', '.join(gaps[:2])}"
        
        return {
            'executive_ready': trust_score >= self.TRUST_THRESHOLD,
            'trust_score': round(trust_score, 1),
            'checklist': checklist,
            'gaps': gaps,
            'strengths': strengths,
            'executive_summary_rewrite_needed': len(gaps) > 2 or trust_score < 6,
            'sections_needing_attention': missing_sections if missing_sections else [],
            'verdict': verdict,
            'verdict_reason': verdict_reason
        }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract evaluation JSON."""
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
            
            logger.warning("Could not parse executive gate response")
            return {}
    
    def get_executive_checklist(self) -> List[Dict]:
        """
        Return the executive checklist for display.
        
        Returns:
            List of checklist items with descriptions
        """
        return [
            {
                'id': 'explainable',
                'question': 'Can I explain this solution in 3 bullets?',
                'description': "Should be clear enough to summarize to a board"
            },
            {
                'id': 'vendor_safe',
                'question': 'Do I know why this vendor is safe?',
                'description': "Track record, team credibility, risk mitigation visible"
            },
            {
                'id': 'risks',
                'question': 'Do risks feel acknowledged?',
                'description': "Realistic challenges with genuine mitigations"
            },
            {
                'id': 'next_steps',
                'question': 'Do I know what happens next?',
                'description': "Clear timeline and obvious first step"
            },
            {
                'id': 'client_specific',
                'question': 'Does this feel written for us?',
                'description': "Client mentioned, constraints understood"
            },
            {
                'id': 'leadership_ready',
                'question': 'Would I bring this to leadership?',
                'description': "Professional, compelling, differentiated"
            }
        ]
    
    def quick_check(self, executive_summary: str, client_name: str = None) -> Dict:
        """
        Quick pass/fail check on executive summary only.
        
        Args:
            executive_summary: The executive summary content
            client_name: Expected client name
            
        Returns:
            Quick pass/fail result
        """
        issues = []
        
        exec_lower = executive_summary.lower()
        word_count = len(executive_summary.split())
        
        # Length check
        if word_count < 150:
            issues.append("Too short")
        elif word_count > 800:
            issues.append("Too long")
        
        # Client name check
        if client_name and client_name.lower() not in exec_lower:
            issues.append("Missing client name")
        
        # Next steps check
        if not any(word in exec_lower for word in ['next', 'start', 'begin', 'contact', 'timeline']):
            issues.append("No clear call to action")
        
        # Value proposition check
        if not any(word in exec_lower for word in ['value', 'benefit', 'outcome', 'result', 'deliver']):
            issues.append("Value proposition unclear")
        
        passed = len(issues) == 0
        
        return {
            'passed': passed,
            'issues': issues,
            'recommendation': 'Ready for review' if passed else f'Fix: {", ".join(issues)}'
        }


def get_executive_confidence_gate(org_id: int = None) -> ExecutiveConfidenceGateAgent:
    """Factory function to get Executive Confidence Gate Agent."""
    return ExecutiveConfidenceGateAgent(org_id=org_id)
