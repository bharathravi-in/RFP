"""
Clarification Agent

Identifies ambiguous questions and generates clarification questions
to ask the client when confidence is low or context is insufficient.
"""
import logging
import json
import re
from typing import Dict, List, Any

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class ClarificationAgent:
    """
    Agent that generates clarification questions.
    - Analyzes questions with low confidence scores (< 0.5)
    - Identifies missing information or ambiguities
    - Generates targeted clarification questions for the client
    - Integrates between Knowledge Retrieval and Answer Generation
    """
    
    CLARIFICATION_PROMPT = """You are an expert at analyzing RFP questions and identifying when additional information is needed.

## Question to Analyze
{question}

## Current Context Available
{context_summary}

## Confidence Score
{confidence_score} (0.0 = no context, 1.0 = excellent context)

## Task
Analyze this question and determine if clarification is needed from the client.

Consider:
1. **Missing Information**: What key details are absent?
2. **Ambiguity**: Are there multiple interpretations?
3. **Scope Unclear**: Is the scope of the requirement unclear?
4. **Technical Specifics**: Are technical details missing?
5. **Context Gaps**: What background information would help?

## Response Format (JSON only)
{{
  "needs_clarification": true/false,
  "confidence_in_answer": 0.0-1.0,
  "issues": [
    {{"type": "missing_info|ambiguity|scope|technical|context", "description": "What's unclear"}}
  ],
  "clarification_questions": [
    {{"question": "Specific question to ask client", "priority": "critical|high|medium|low", "reasoning": "Why this is needed"}}
  ],
  "assumptions_to_verify": ["List of assumptions we'd make without clarification"]
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "ClarificationAgent"
    
    def analyze_questions(
        self,
        draft_answers: List[Dict] = None,
        knowledge_context: Dict = None,
        session_state: Dict = None,
        confidence_threshold: float = 0.5
    ) -> Dict:
        """
        Analyze questions and generate clarifications where needed.
        
        Args:
            draft_answers: Draft answers with confidence scores
            knowledge_context: Knowledge context from KB Agent
            session_state: Shared state
            confidence_threshold: Generate clarifications if confidence < this
            
        Returns:
            Clarification requirements for low-confidence questions
        """
        session_state = session_state or {}
        
        # Get data from session if not provided
        draft_answers = draft_answers or session_state.get(SessionKeys.DRAFT_ANSWERS, [])
        knowledge_context = knowledge_context or session_state.get(SessionKeys.KNOWLEDGE_CONTEXT, {})
        
        if not draft_answers:
            return {"success": False, "error": "No answers to analyze"}
        
        clarifications = []
        
        for answer in draft_answers:
            confidence = answer.get("confidence_score", 0.5)
            
            # Only generate clarifications for low-confidence questions
            if confidence < confidence_threshold:
                q_id = answer.get("question_id", 0)
                q_text = answer.get("question_text", "")
                q_context = knowledge_context.get(q_id, {})
                
                try:
                    clarification = self._generate_clarification(
                        question=q_text,
                        context=q_context,
                        confidence=confidence
                    )
                    
                    if clarification.get("needs_clarification"):
                        clarifications.append({
                            "question_id": q_id,
                            "question_text": q_text,
                            "original_confidence": confidence,
                            **clarification
                        })
                except Exception as e:
                    logger.error(f"Clarification generation failed for question {q_id}: {e}")
        
        # Store in session state
        session_state[SessionKeys.CLARIFICATION_QUESTIONS] = clarifications
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "clarifications_identified",
            "summary": f"Identified {len(clarifications)} questions needing clarification"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "clarifications": clarifications,
            "total_analyzed": len(draft_answers),
            "needs_clarification_count": len(clarifications),
            "session_state": session_state
        }
    
    def _generate_clarification(
        self,
        question: str,
        context: Dict,
        confidence: float
    ) -> Dict:
        """Generate clarification for a single question."""
        client = self.config.client
        if not client:
            return self._fallback_clarification(question, context, confidence)
        
        # Summarize available context
        knowledge_items = context.get("knowledge_items", [])
        similar_answers = context.get("similar_answers", [])
        
        context_summary = ""
        if knowledge_items:
            context_summary += f"Knowledge Items: {len(knowledge_items)} found\n"
            context_summary += "\n".join([f"- {item.get('title', 'Unknown')}" for item in knowledge_items[:3]])
        else:
            context_summary += "No relevant knowledge items found.\n"
        
        if similar_answers:
            context_summary += f"\nSimilar Answers: {len(similar_answers)} found"
        else:
            context_summary += "\nNo similar previous answers found."
        
        prompt = self.CLARIFICATION_PROMPT.format(
            question=question,
            context_summary=context_summary,
            confidence_score=confidence
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
            logger.error(f"Clarification generation error: {e}")
            return self._fallback_clarification(question, context, confidence)
    
    def _fallback_clarification(self, question: str, context: Dict, confidence: float) -> Dict:
        """Fallback clarification when AI is unavailable."""
        # Simple heuristic: low confidence always needs clarification
        needs_clarification = confidence < 0.3
        
        issues = []
        clarification_questions = []
        
        if confidence < 0.3:
            issues.append({
                "type": "missing_info",
                "description": "Very low confidence - insufficient context available"
            })
            clarification_questions.append({
                "question": f"Can you provide more details about: {question[:100]}?",
                "priority": "high",
                "reasoning": "No relevant information found in knowledge base"
            })
        
        return {
            "needs_clarification": needs_clarification,
            "confidence_in_answer": confidence,
            "issues": issues,
            "clarification_questions": clarification_questions,
            "assumptions_to_verify": []
        }


def get_clarification_agent() -> ClarificationAgent:
    """Factory function to get Clarification Agent."""
    return ClarificationAgent()
