"""
Clarification Agent

Identifies ambiguous questions and generates clarification questions
to ask the client when confidence is low or context is insufficient.
Enhanced with priority scoring and automatic follow-ups.
"""
import logging
import json
import re
from typing import Dict, List, Any
from datetime import datetime

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class ClarificationAgent:
    """
    Agent that generates clarification questions with priority scoring.
    - Analyzes questions with low confidence scores (< 0.5)
    - Assigns priority scores based on question criticality
    - Calculates urgency based on deadline proximity
    - Groups clarifications by category for efficient communication
    - Generates follow-up tracking data
    """
    
    # Priority weights for different question types
    PRIORITY_WEIGHTS = {
        "security": 1.5,
        "compliance": 1.5,
        "pricing": 1.3,
        "technical": 1.2,
        "legal": 1.4,
        "integration": 1.1,
        "support": 1.0,
        "product": 1.0,
        "general": 0.8
    }
    
    CLARIFICATION_PROMPT = """You are an expert at analyzing RFP questions and identifying when additional information is needed.

## Question to Analyze
Category: {category}
{question}

## Current Context Available
{context_summary}

## Confidence Score
{confidence_score} (0.0 = no context, 1.0 = excellent context)

## Deadline Context
{deadline_info}

## Task
Analyze this question and determine:
1. If clarification is needed from the client
2. The priority level of getting clarification
3. The impact on proposal quality if clarification isn't received

Consider:
1. **Missing Information**: What key details are absent?
2. **Ambiguity**: Are there multiple interpretations?
3. **Scope Unclear**: Is the scope of the requirement unclear?
4. **Technical Specifics**: Are technical details missing?
5. **Context Gaps**: What background information would help?
6. **Risk Assessment**: What's the risk of answering without clarification?

## Response Format (JSON only)
{{
  "needs_clarification": true/false,
  "confidence_in_answer": 0.0-1.0,
  "priority_score": 0.0-1.0,
  "urgency_level": "critical|high|medium|low",
  "impact_without_clarification": "high|medium|low",
  "issues": [
    {{"type": "missing_info|ambiguity|scope|technical|context|risk", "description": "What's unclear", "severity": "critical|high|medium|low"}}
  ],
  "clarification_questions": [
    {{"question": "Specific question to ask client", "priority": "critical|high|medium|low", "reasoning": "Why this is needed", "expected_answer_type": "text|number|yes_no|list|document"}}
  ],
  "assumptions_to_verify": ["List of assumptions we'd make without clarification"],
  "suggested_default_approach": "What we'd do if no clarification received",
  "risk_score": 0.0-1.0
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "ClarificationAgent"
        self.org_id = org_id
    
    def analyze_questions(
        self,
        draft_answers: List[Dict] = None,
        knowledge_context: Dict = None,
        session_state: Dict = None,
        confidence_threshold: float = 0.5,
        deadline: datetime = None
    ) -> Dict:
        """
        Analyze questions and generate prioritized clarifications.
        
        Args:
            draft_answers: Draft answers with confidence scores
            knowledge_context: Knowledge context from KB Agent
            session_state: Shared state
            confidence_threshold: Generate clarifications if confidence < this
            deadline: RFP deadline for urgency calculation
            
        Returns:
            Prioritized clarification requirements
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
            category = answer.get("category", "general")
            
            # Calculate adjusted threshold based on category importance
            weight = self.PRIORITY_WEIGHTS.get(category, 1.0)
            adjusted_threshold = confidence_threshold * (2 - weight)
            
            # Generate clarifications for low-confidence or high-priority questions
            if confidence < adjusted_threshold or (confidence < 0.6 and weight > 1.2):
                q_id = answer.get("question_id", 0)
                q_text = answer.get("question_text", "")
                q_context = knowledge_context.get(q_id, {})
                
                try:
                    clarification = self._generate_clarification(
                        question=q_text,
                        category=category,
                        context=q_context,
                        confidence=confidence,
                        deadline=deadline
                    )
                    
                    if clarification.get("needs_clarification"):
                        # Calculate overall priority score
                        priority_score = self._calculate_priority_score(
                            clarification=clarification,
                            category=category,
                            confidence=confidence,
                            deadline=deadline
                        )
                        
                        clarifications.append({
                            "question_id": q_id,
                            "question_text": q_text,
                            "category": category,
                            "original_confidence": confidence,
                            "priority_score": priority_score,
                            **clarification
                        })
                except Exception as e:
                    logger.error(f"Clarification generation failed for question {q_id}: {e}")
        
        # Sort by priority score (highest first)
        clarifications.sort(key=lambda x: x.get("priority_score", 0), reverse=True)
        
        # Group by category for efficient client communication
        grouped = self._group_by_category(clarifications)
        
        # Store in session state
        session_state[SessionKeys.CLARIFICATION_QUESTIONS] = clarifications
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        critical_count = len([c for c in clarifications if c.get("urgency_level") == "critical"])
        messages.append({
            "agent": self.name,
            "action": "clarifications_identified",
            "summary": f"Identified {len(clarifications)} questions needing clarification ({critical_count} critical)"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "clarifications": clarifications,
            "grouped_by_category": grouped,
            "total_analyzed": len(draft_answers),
            "needs_clarification_count": len(clarifications),
            "critical_count": critical_count,
            "high_priority_count": len([c for c in clarifications if c.get("urgency_level") in ["critical", "high"]]),
            "session_state": session_state
        }
    
    def _calculate_priority_score(
        self,
        clarification: Dict,
        category: str,
        confidence: float,
        deadline: datetime = None
    ) -> float:
        """Calculate overall priority score (0-1)."""
        base_score = 0.0
        
        # Factor 1: Base from clarification analysis (40%)
        risk_score = clarification.get("risk_score", 0.5)
        base_score += risk_score * 0.4
        
        # Factor 2: Category importance (25%)
        category_weight = self.PRIORITY_WEIGHTS.get(category, 1.0)
        base_score += (category_weight / 1.5) * 0.25  # Normalize to 0-1
        
        # Factor 3: Confidence gap (20%)
        confidence_gap = 1 - confidence
        base_score += confidence_gap * 0.2
        
        # Factor 4: Deadline urgency (15%)
        if deadline:
            days_until = (deadline - datetime.utcnow()).days
            if days_until < 0:
                urgency = 1.0
            elif days_until < 3:
                urgency = 0.9
            elif days_until < 7:
                urgency = 0.7
            elif days_until < 14:
                urgency = 0.5
            else:
                urgency = 0.2
            base_score += urgency * 0.15
        else:
            base_score += 0.5 * 0.15  # Default medium urgency
        
        return min(1.0, base_score)
    
    def _group_by_category(self, clarifications: List[Dict]) -> Dict[str, List[Dict]]:
        """Group clarifications by category for efficient communication."""
        grouped = {}
        for c in clarifications:
            cat = c.get("category", "general")
            if cat not in grouped:
                grouped[cat] = []
            grouped[cat].append(c)
        return grouped
    
    def _generate_clarification(
        self,
        question: str,
        category: str,
        context: Dict,
        confidence: float,
        deadline: datetime = None
    ) -> Dict:
        """Generate clarification for a single question."""
        client = self.config.client
        if not client:
            return self._fallback_clarification(question, context, confidence, category)
        
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
        
        # Deadline info
        deadline_info = "No deadline specified"
        if deadline:
            days_until = (deadline - datetime.utcnow()).days
            deadline_info = f"Deadline in {days_until} days"
            if days_until < 7:
                deadline_info += " (URGENT)"
        
        prompt = self.CLARIFICATION_PROMPT.format(
            question=question,
            category=category,
            context_summary=context_summary,
            confidence_score=confidence,
            deadline_info=deadline_info
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
            return self._fallback_clarification(question, context, confidence, category)
    
    def _fallback_clarification(
        self,
        question: str,
        context: Dict,
        confidence: float,
        category: str = "general"
    ) -> Dict:
        """Fallback clarification when AI is unavailable."""
        # Calculate if clarification is needed based on thresholds
        category_weight = self.PRIORITY_WEIGHTS.get(category, 1.0)
        needs_clarification = confidence < (0.3 * category_weight)
        
        issues = []
        clarification_questions = []
        
        if confidence < 0.3:
            issues.append({
                "type": "missing_info",
                "description": "Very low confidence - insufficient context available",
                "severity": "high"
            })
            clarification_questions.append({
                "question": f"Can you provide more details about: {question[:100]}?",
                "priority": "high" if category_weight > 1.2 else "medium",
                "reasoning": "No relevant information found in knowledge base",
                "expected_answer_type": "text"
            })
        elif confidence < 0.5 and category_weight > 1.2:
            issues.append({
                "type": "context",
                "description": f"Low confidence for high-priority {category} question",
                "severity": "medium"
            })
            clarification_questions.append({
                "question": f"Please clarify the specific requirements for: {question[:80]}",
                "priority": "medium",
                "reasoning": f"{category.title()} questions require accurate responses",
                "expected_answer_type": "text"
            })
        
        # Calculate urgency
        if category in ["security", "compliance", "legal"]:
            urgency = "high" if confidence < 0.4 else "medium"
        else:
            urgency = "medium" if confidence < 0.3 else "low"
        
        return {
            "needs_clarification": needs_clarification,
            "confidence_in_answer": confidence,
            "priority_score": (1 - confidence) * category_weight,
            "urgency_level": urgency,
            "impact_without_clarification": "high" if category_weight > 1.2 else "medium",
            "issues": issues,
            "clarification_questions": clarification_questions,
            "assumptions_to_verify": [],
            "suggested_default_approach": "Use best available information with disclaimer",
            "risk_score": (1 - confidence) * 0.8
        }
    
    def get_follow_up_status(
        self,
        clarifications: List[Dict],
        responses: Dict[int, str] = None
    ) -> Dict:
        """
        Track follow-up status for clarifications.
        
        Args:
            clarifications: Original clarification requests
            responses: Dict of question_id -> client response
            
        Returns:
            Status summary of clarification requests
        """
        responses = responses or {}
        
        pending = []
        resolved = []
        
        for c in clarifications:
            q_id = c.get("question_id")
            if q_id in responses:
                resolved.append({
                    "question_id": q_id,
                    "response": responses[q_id],
                    "original_clarification": c
                })
            else:
                pending.append(c)
        
        return {
            "total": len(clarifications),
            "pending": len(pending),
            "resolved": len(resolved),
            "pending_clarifications": pending,
            "resolved_clarifications": resolved,
            "completion_rate": len(resolved) / len(clarifications) if clarifications else 1.0
        }


def get_clarification_agent() -> ClarificationAgent:
    """Factory function to get Clarification Agent."""
    return ClarificationAgent()

