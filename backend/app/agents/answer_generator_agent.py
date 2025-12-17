"""
Answer Generator Agent

Generates AI-powered answers for RFP questions using RAG approach.
"""
import logging
import json
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig  # NEW

logger = logging.getLogger(__name__)


class AnswerGeneratorAgent:
    """
    Agent that generates answers for RFP questions.
    - Uses context from Knowledge Base Agent
    - Generates category-specific answers
    - Configurable tone and length
    """
    
    # Category-specific instructions
    CATEGORY_INSTRUCTIONS = {
        'security': """For security questions:
- Be precise about security claims
- Reference certifications (SOC 2, ISO 27001)
- Include encryption standards where relevant
- Never overstate capabilities""",
        
        'compliance': """For compliance questions:
- Reference frameworks accurately
- Be clear about certification status
- Note geographic/industry considerations""",
        
        'technical': """For technical questions:
- Provide specific technical details
- Include version numbers and standards
- Mention integration capabilities""",
        
        'pricing': """For pricing questions:
- Be clear about pricing structure
- Note variables affecting pricing
- Suggest contacting sales for quotes""",
        
        'legal': """For legal questions:
- Use cautious, precise language
- Avoid binding commitments
- Suggest involving legal teams""",
        
        'product': """For product questions:
- Focus on current capabilities
- Distinguish roadmap vs available now
- Reference documentation"""
    }
    
    GENERATION_PROMPT = """You are an expert RFP response writer.

## Question
{question}

## Context from Knowledge Base
{context}

## Similar Approved Answers
{similar_answers}

## Instructions
- Tone: {tone}
- Length: {length_instruction}
- Category: {category}
{category_instructions}

## Requirements
- Use context to build accurate answers
- Be specific, avoid vague statements
- Never make unverifiable claims
- Match the tone of approved similar answers

Write the answer directly, no preamble."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "AnswerGeneratorAgent"
    
    def generate_answers(
        self,
        questions: List[Dict] = None,
        knowledge_context: Dict = None,
        tone: str = "professional",
        length: str = "medium",
        session_state: Dict = None
    ) -> Dict:
        """
        Generate answers for questions using context.
        
        Args:
            questions: List of questions to answer
            knowledge_context: Context mapping from Knowledge Base Agent
            tone: professional, formal, or friendly
            length: short, medium, or long
            session_state: Shared state
            
        Returns:
            Generated answers with metadata
        """
        session_state = session_state or {}
        
        # Get data from session if not provided
        questions = questions or session_state.get(SessionKeys.EXTRACTED_QUESTIONS, [])
        knowledge_context = knowledge_context or session_state.get(SessionKeys.KNOWLEDGE_CONTEXT, {})
        
        if not questions:
            return {"success": False, "error": "No questions to answer"}
        
        draft_answers = []
        
        for question in questions:
            q_id = question.get("id", 0)
            q_text = question.get("text", "")
            q_category = question.get("category", "general")
            
            # Get context for this question
            q_context = knowledge_context.get(q_id, {})
            
            try:
                answer = self._generate_answer(
                    question=q_text,
                    category=q_category,
                    context=q_context,
                    tone=tone,
                    length=length
                )
            except Exception as e:
                logger.error(f"Answer generation failed for question {q_id}: {e}")
                answer = {
                    "content": f"[Error generating answer: {str(e)}]",
                    "confidence": 0.0,
                    "flags": ["generation_error"]
                }
            
            draft_answers.append({
                "question_id": q_id,
                "question_text": q_text,
                "category": q_category,
                "answer": answer["content"],
                "confidence_score": answer.get("confidence", 0.5),
                "flags": answer.get("flags", []),
                "sources": q_context.get("knowledge_items", [])[:3]
            })
        
        # Store in session state
        session_state[SessionKeys.DRAFT_ANSWERS] = draft_answers
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        high_confidence = len([a for a in draft_answers if a["confidence_score"] >= 0.7])
        messages.append({
            "agent": self.name,
            "action": "answers_generated",
            "summary": f"Generated {len(draft_answers)} answers ({high_confidence} high confidence)"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "answers": draft_answers,
            "stats": {
                "total": len(draft_answers),
                "high_confidence": high_confidence,
                "needs_review": len([a for a in draft_answers if a["confidence_score"] < 0.5])
            },
            "session_state": session_state
        }
    
    @with_retry(
        config=RetryConfig(max_attempts=2, initial_delay=0.5),
        fallback_models=['gemini-1.5-pro']
    )
    def _generate_answer(
        self,
        question: str,
        category: str,
        context: Dict,
        tone: str,
        length: str
    ) -> Dict:
        """Generate a single answer."""
        client = self.config.client
        if not client:
            return self._placeholder_answer(question)
        
        # Format context
        knowledge_items = context.get("knowledge_items", [])
        context_text = "\n\n".join([
            f"[{item['title']}] {item['content']}"
            for item in knowledge_items
        ]) if knowledge_items else "No specific context available."
        
        # Format similar answers
        similar = context.get("similar_answers", [])
        similar_text = "\n\n".join([
            f"Q: {s['question_text'][:100]}...\nA: {s['answer_content']}"
            for s in similar
        ]) if similar else "No similar answers available."
        
        # Length instruction
        length_map = {
            'short': 'Keep answer to 2-3 sentences.',
            'medium': 'Provide balanced answer, 4-6 sentences.',
            'long': 'Provide detailed answer with examples.'
        }
        
        prompt = self.GENERATION_PROMPT.format(
            question=question,
            context=context_text,
            similar_answers=similar_text,
            tone=tone,
            length_instruction=length_map.get(length, length_map['medium']),
            category=category,
            category_instructions=self.CATEGORY_INSTRUCTIONS.get(category, "")
        )
        
        try:
            if self.config.is_adk_enabled:
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=prompt
                )
                content = response.text
            else:
                response = client.generate_content(prompt)
                content = response.text
            
            # Calculate confidence
            confidence = self._calculate_confidence(context, similar)
            flags = []
            if confidence < 0.5:
                flags.extend(["low_confidence", "needs_review"])
            elif confidence < 0.7:
                flags.append("review_recommended")
            
            return {
                "content": content.strip(),
                "confidence": confidence,
                "flags": flags
            }
            
        except Exception as e:
            logger.error(f"Generation error: {e}")
            return self._placeholder_answer(question)
    
    def _calculate_confidence(self, context: Dict, similar: List) -> float:
        """Calculate confidence score based on context quality."""
        score = 0.4  # Base
        
        knowledge_items = context.get("knowledge_items", [])
        if knowledge_items:
            max_relevance = max(item.get("relevance", 0) for item in knowledge_items)
            if max_relevance > 0.8:
                score += 0.2
            if len(knowledge_items) >= 3:
                score += 0.1
        
        if similar:
            max_similarity = max(s.get("similarity_score", 0) for s in similar)
            if max_similarity > 0.85:
                score += 0.25
        
        return min(1.0, round(score, 2))
    
    def _placeholder_answer(self, question: str) -> Dict:
        """Return placeholder when AI is unavailable."""
        return {
            "content": f"[AI service unavailable. Question: {question[:100]}...]",
            "confidence": 0.0,
            "flags": ["ai_unavailable", "needs_manual_answer"]
        }


def get_answer_generator_agent() -> AnswerGeneratorAgent:
    """Factory function to get Answer Generator Agent."""
    return AnswerGeneratorAgent()
