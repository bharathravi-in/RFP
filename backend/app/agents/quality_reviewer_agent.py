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
    - Multi-dimensional quality scoring (5 dimensions)
    - Readability assessment
    - Minimum threshold enforcement
    """
    
    # Multi-dimensional quality scoring (5 dimensions)
    QUALITY_DIMENSIONS = {
        'accuracy': {
            'weight': 0.25,
            'description': 'Factual correctness and knowledge base alignment',
            'min_acceptable': 0.60
        },
        'completeness': {
            'weight': 0.20,
            'description': 'All parts of question addressed',
            'min_acceptable': 0.70
        },
        'clarity': {
            'weight': 0.20,
            'description': 'Readability and understandability',
            'min_acceptable': 0.60
        },
        'relevance': {
            'weight': 0.20,
            'description': 'Direct relevance to question asked',
            'min_acceptable': 0.70
        },
        'tone': {
            'weight': 0.15,
            'description': 'Professional and confident language',
            'min_acceptable': 0.60
        }
    }
    
    # Minimum thresholds for different actions
    MINIMUM_THRESHOLDS = {
        'auto_approve': 0.85,       # Auto-approve if above this
        'human_review': 0.70,       # Require human review if below
        'auto_reject': 0.40,        # Auto-reject if below this
        'revision_required': 0.55   # Require revision before approval
    }
    
    # Readability configuration
    READABILITY_CONFIG = {
        'target_grade_level': 10,       # Target 10th grade reading level
        'max_grade_level': 14,          # Maximum acceptable grade level
        'min_flesch_score': 45,         # Minimum Flesch Reading Ease
        'max_sentence_length': 25,      # Max average words per sentence
        'max_paragraph_length': 150     # Max words per paragraph
    }
    
    # NEW: Anti-AI Detection Indicators (P2 Enhancement)
    AI_PATTERN_INDICATORS = {
        'over_polished_phrases': [
            'it is important to note that',
            'in conclusion',
            'furthermore',
            'moreover',
            'additionally',
            'in today\'s rapidly evolving',
            'in the modern world',
            'it goes without saying',
            'needless to say',
            'at the end of the day',
            'moving forward',
            'going forward',
            'in order to',
            'due to the fact that',
            'in terms of',
            'with respect to',
            'for the purpose of',
            'in light of',
            'as per our discussion',
            'please be advised'
        ],
        'empty_adjectives': [
            'innovative',
            'cutting-edge',
            'state-of-the-art',
            'revolutionary',
            'groundbreaking',
            'world-class',
            'best-in-class',
            'seamless',
            'robust',
            'comprehensive',
            'holistic',
            'synergistic',
            'paradigm',
            'leverage',
            'optimize',
            'streamline',
            'enhance',
            'empower',
            'transformative'
        ],
        'ai_sentence_patterns': [
            r'^(?:In today\'s|In the modern|As we move)',
            r'^(?:It is worth noting|It should be noted)',
            r'^(?:This approach|This solution|This methodology) allows',
            r'(?:ensure|ensures) seamless',
            r'(?:drive|drives|driving) business (?:value|outcomes|success)',
            r'key (?:advantages|benefits|features) include',
            r'(?:uniquely|strategically) positioned'
        ],
        'structural_indicators': {
            'sentence_length_uniformity_threshold': 5.0,  # Low variance = AI-like
            'filler_phrase_ratio_threshold': 0.15,  # High ratio = AI-like
            'empty_adjective_ratio_threshold': 0.10  # High ratio = AI-like
        }
    }

    
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

### Enterprise Checks
11. **Forbidden Phrases**: Check for marketing buzzwords (world-class, cutting-edge, synergy)
12. **Client Specificity**: Does it reference the client's situation?
13. **Evidence Density**: Are claims backed by evidence?

Return JSON:
{{
  "quality_score": 0.0-1.0,
  "quality_grade": "A|B|C|D|F",
  "accuracy_score": 0.0-1.0,
  "compliance_score": 0.0-1.0,
  "readability_score": 0.0-1.0,
  "dimension_scores": {{
    "accuracy": 0.0-1.0,
    "completeness": 0.0-1.0,
    "clarity": 0.0-1.0,
    "relevance": 0.0-1.0,
    "tone": 0.0-1.0
  }},
  "issues": [
    {{"issue": "Issue description", "severity": "critical|high|medium|low", "fix": "How to fix"}}
  ],
  "improvements": ["suggestion1", "suggestion2"],
  "verified_claims": true/false,
  "unverified_claims": [
    {{"claim": "claim text", "risk": "What could go wrong"}}
  ],
  "compliance_concerns": [
    {{"concern": "issue", "severity": "critical|high|medium|low"}}
  ],
  "forbidden_phrases_found": ["list of marketing buzzwords found"],
  "ai_detection": {{
    "likelihood": "low|medium|high",
    "indicators": ["what triggered AI detection"]
  }},
  "needs_human_review": true/false,
  "review_reason": "why human review needed if applicable",
  "recommended_action": "approve|revise|reject",
  "confidence_level": "HIGH|MEDIUM|LOW",
  "confidence_rationale": "Why this confidence level",
  "procurement_assessment": {{
    "evaluator_ready": true/false,
    "concerns": ["List of evaluator concerns"]
  }},
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
    
    def detect_ai_patterns(self, content: str) -> Dict[str, Any]:
        """
        Detect AI-generated patterns in content.
        
        Checks for:
        - Over-polished phrases common in AI output
        - Empty adjectives that add no value
        - AI-typical sentence patterns
        - Structural uniformity (AI tends to be very regular)
        
        Returns detection result with recommendations.
        """
        content_lower = content.lower()
        sentences = [s.strip() for s in re.split(r'[.!?]+', content) if s.strip()]
        words = content_lower.split()
        
        result = {
            'ai_likelihood': 'low',
            'score': 0.0,
            'indicators_found': [],
            'recommendations': []
        }
        
        # Check over-polished phrases
        polished_found = []
        for phrase in self.AI_PATTERN_INDICATORS['over_polished_phrases']:
            if phrase.lower() in content_lower:
                polished_found.append(phrase)
        
        # Check empty adjectives
        empty_adj_found = []
        for adj in self.AI_PATTERN_INDICATORS['empty_adjectives']:
            if adj.lower() in content_lower:
                empty_adj_found.append(adj)
        
        # Check AI sentence patterns
        pattern_matches = 0
        for pattern in self.AI_PATTERN_INDICATORS['ai_sentence_patterns']:
            for sentence in sentences:
                if re.search(pattern, sentence, re.IGNORECASE):
                    pattern_matches += 1
        
        # Check sentence length uniformity
        sentence_lengths = [len(s.split()) for s in sentences if s]
        if sentence_lengths:
            avg_length = sum(sentence_lengths) / len(sentence_lengths)
            variance = sum((l - avg_length) ** 2 for l in sentence_lengths) / len(sentence_lengths)
            std_dev = variance ** 0.5
        else:
            std_dev = 0
        
        # Calculate AI likelihood score
        score = 0.0
        
        # Penalize for over-polished phrases
        polished_ratio = len(polished_found) / max(1, len(sentences))
        if polished_ratio > 0.15:
            score += 0.3
            result['indicators_found'].append(f'{len(polished_found)} over-polished phrases')
        
        # Penalize for empty adjectives
        empty_ratio = len(empty_adj_found) / max(1, len(words) / 100)
        if empty_ratio > 0.10:
            score += 0.25
            result['indicators_found'].append(f'{len(empty_adj_found)} empty adjectives')
        
        # Penalize for AI sentence patterns
        pattern_ratio = pattern_matches / max(1, len(sentences))
        if pattern_ratio > 0.10:
            score += 0.25
            result['indicators_found'].append(f'{pattern_matches} AI-typical sentence patterns')
        
        # Penalize for low sentence length variance (AI is uniform)
        if std_dev < 5.0 and len(sentences) >= 3:
            score += 0.2
            result['indicators_found'].append('Low sentence length variance (very uniform)')
        
        result['score'] = round(min(1.0, score), 2)
        
        # Determine likelihood level
        if score >= 0.6:
            result['ai_likelihood'] = 'high'
            result['recommendations'] = [
                'Major rewrite recommended - content appears AI-generated',
                'Replace with client-specific language',
                'Remove generic phrases and add concrete evidence'
            ]
        elif score >= 0.35:
            result['ai_likelihood'] = 'medium'
            result['recommendations'] = [
                'Review and humanize language',
                f'Remove these phrases: {", ".join(polished_found[:3])}' if polished_found else '',
                f'Replace empty adjectives: {", ".join(empty_adj_found[:3])}' if empty_adj_found else ''
            ]
        else:
            result['ai_likelihood'] = 'low'
            result['recommendations'] = ['Content appears human-written']
        
        # Add detail
        result['detail'] = {
            'over_polished_phrases': polished_found,
            'empty_adjectives': empty_adj_found,
            'ai_patterns': pattern_matches,
            'sentence_variance': round(std_dev, 2),
            'thresholds': self.AI_PATTERN_INDICATORS['structural_indicators']
        }
        
        return result


def get_quality_reviewer_agent(org_id: int = None) -> QualityReviewerAgent:
    """Factory function to get Quality Reviewer Agent."""
    return QualityReviewerAgent(org_id=org_id)
