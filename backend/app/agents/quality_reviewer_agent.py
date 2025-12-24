"""
Quality Reviewer Agent

Reviews generated answers for accuracy, compliance, and quality.
"""
import logging
import json
import re
from typing import Dict, List, Any

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class QualityReviewerAgent:
    """
    Agent that reviews generated answers.
    - Checks for accuracy and consistency
    - Validates compliance requirements
    - Assigns final confidence scores
    - Flags issues for human review
    """
    
    REVIEW_PROMPT = """Review this RFP answer for quality, accuracy, and compliance.

## Question
Category: {category}
{question}

## Generated Answer
{answer}

## Context Used
{context}

## Validation Results (if available)
{validation_info}

## Extended Review Criteria

### Core Quality Checks
1. **Accuracy**: Does the answer align with the knowledge context provided?
2. **Completeness**: Does it fully address all parts of the question?
3. **Tone**: Is it professional, confident, and appropriate for RFP responses?
4. **Clarity**: Is it easy to understand without jargon overload?

### Compliance & Risk Checks
5. **Claim Verification**: Are all factual claims supported by the context?
6. **Compliance Claims**: For security/compliance questions, are certifications accurate?
7. **Over-promises**: Does it make commitments that may be hard to fulfill?
8. **Competitor Mentions**: Does it inappropriately mention competitors?

### Readability Checks
9. **Length Appropriateness**: Is the answer length appropriate for the question?
10. **Structure**: Is it well-organized with clear flow?

Return JSON:
{{
  "quality_score": 0.0-1.0,
  "accuracy_score": 0.0-1.0,
  "compliance_score": 0.0-1.0,
  "readability_score": 0.0-1.0,
  "issues": ["issue1", "issue2"],
  "issue_severity": {{"issue1": "critical|high|medium|low"}},
  "improvements": ["suggestion1", "suggestion2"],
  "verified_claims": true/false,
  "unverified_claims": ["claim that lacks evidence"],
  "compliance_concerns": ["any compliance issue found"],
  "needs_human_review": true/false,
  "review_reason": "why human review needed if applicable",
  "recommended_action": "approve|revise|reject",
  "revised_answer": "optional improved answer if needed"
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "QualityReviewerAgent"
    
    def review_answers(
        self,
        draft_answers: List[Dict] = None,
        session_state: Dict = None
    ) -> Dict:
        """
        Review generated answers for quality.
        
        Args:
            draft_answers: List of draft answers to review
            session_state: Shared state with answers and context
            
        Returns:
            Reviewed answers with quality assessments
        """
        session_state = session_state or {}
        
        # Get answers from session if not provided
        draft_answers = draft_answers or session_state.get(SessionKeys.DRAFT_ANSWERS, [])
        knowledge_context = session_state.get(SessionKeys.KNOWLEDGE_CONTEXT, {})
        
        if not draft_answers:
            return {"success": False, "error": "No answers to review"}
        
        reviewed_answers = []
        
        for answer in draft_answers:
            q_id = answer.get("question_id", 0)
            q_context = knowledge_context.get(q_id, {})
            
            try:
                review = self._review_answer(
                    question=answer.get("question_text", ""),
                    answer=answer.get("answer", ""),
                    context=q_context,
                    initial_confidence=answer.get("confidence_score", 0.5)
                )
            except Exception as e:
                logger.error(f"Review failed for answer {q_id}: {e}")
                review = self._fallback_review(answer)
            
            # Merge review with original answer
            reviewed = {
                **answer,
                "quality_score": review.get("quality_score", 0.5),
                "issues": review.get("issues", []),
                "improvements": review.get("improvements", []),
                "needs_human_review": review.get("needs_human_review", True),
                "review_reason": review.get("review_reason", ""),
                "final_answer": review.get("revised_answer", answer.get("answer", "")),
                "reviewed": True
            }
            
            # Update flags based on review
            if reviewed["needs_human_review"]:
                if "needs_review" not in reviewed.get("flags", []):
                    reviewed.setdefault("flags", []).append("needs_review")
            
            reviewed_answers.append(reviewed)
        
        # Store in session state
        session_state[SessionKeys.REVIEWED_ANSWERS] = reviewed_answers
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        needs_review = len([a for a in reviewed_answers if a["needs_human_review"]])
        avg_quality = sum(a["quality_score"] for a in reviewed_answers) / len(reviewed_answers)
        messages.append({
            "agent": self.name,
            "action": "answers_reviewed",
            "summary": f"Reviewed {len(reviewed_answers)} answers (avg quality: {avg_quality:.0%}, {needs_review} need human review)"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "reviewed_answers": reviewed_answers,
            "stats": {
                "total": len(reviewed_answers),
                "average_quality": round(avg_quality, 2),
                "needs_human_review": needs_review,
                "approved": len([a for a in reviewed_answers if not a["needs_human_review"]])
            },
            "session_state": session_state
        }
    
    def _review_answer(
        self,
        question: str,
        answer: str,
        context: Dict,
        initial_confidence: float,
        category: str = "general",
        validation_info: Dict = None
    ) -> Dict:
        """Review a single answer."""
        client = self.config.client
        if not client:
            return self._fallback_review({"answer": answer, "confidence_score": initial_confidence})
        
        # Format context
        knowledge_items = context.get("knowledge_items", [])
        context_text = "\n".join([
            f"- {item['content'][:300]}"
            for item in knowledge_items
        ]) if knowledge_items else "No context available."
        
        # Format validation info
        validation_text = "No validation data available."
        if validation_info:
            validation_text = f"""
Accuracy Score: {validation_info.get('accuracy_score', 'N/A')}
Verified Claims: {validation_info.get('verified_claims', 0)}
Unverified Claims: {validation_info.get('unverified_claims', 0)}"""
        
        prompt = self.REVIEW_PROMPT.format(
            question=question,
            answer=answer,
            context=context_text,
            category=category,
            validation_info=validation_text
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
            
            review = json.loads(response_text)
            
            # If no revised answer provided, keep original
            if not review.get("revised_answer"):
                review["revised_answer"] = answer
            
            return review
            
        except Exception as e:
            logger.error(f"Review error: {e}")
            return self._fallback_review({"answer": answer, "confidence_score": initial_confidence})
    
    def _fallback_review(self, answer: Dict) -> Dict:
        """Fallback review when AI is unavailable."""
        confidence = answer.get("confidence_score", 0.5)
        answer_text = answer.get("answer", "")
        
        # Simple heuristic checks
        issues = []
        if len(answer_text) < 50:
            issues.append("Answer may be too brief")
        if "[" in answer_text and "]" in answer_text:
            issues.append("Contains placeholder text")
        
        return {
            "quality_score": confidence,
            "issues": issues,
            "improvements": [],
            "verified_claims": False,
            "needs_human_review": True,
            "review_reason": "AI review unavailable - manual review recommended",
            "revised_answer": answer_text
        }


def get_quality_reviewer_agent() -> QualityReviewerAgent:
    """Factory function to get Quality Reviewer Agent."""
    return QualityReviewerAgent()
