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
    
    REVIEW_PROMPT = """Review this RFP answer for quality and accuracy.

## Question
{question}

## Generated Answer
{answer}

## Context Used
{context}

## Review Criteria
1. Accuracy: Does the answer align with the context provided?
2. Completeness: Does it fully address the question?
3. Tone: Is it professional and appropriate?
4. Claims: Are all claims verifiable from context?
5. Compliance: For security/compliance questions, are statements accurate?

Return JSON:
{{
  "quality_score": 0.0-1.0,
  "issues": ["issue1", "issue2"],
  "improvements": ["suggestion1", "suggestion2"],
  "verified_claims": true/false,
  "needs_human_review": true/false,
  "review_reason": "why human review needed if applicable",
  "revised_answer": "optional improved answer if needed"
}}

Return ONLY valid JSON."""

    def __init__(self):
        self.config = get_agent_config()
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
        initial_confidence: float
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
        
        prompt = self.REVIEW_PROMPT.format(
            question=question,
            answer=answer,
            context=context_text
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
