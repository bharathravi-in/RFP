"""
AI Answer Quality Scoring Service.

Evaluates generated answers for quality, completeness, and accuracy.
"""
import re
import logging
from typing import Dict, List, Optional, Tuple
import google.generativeai as genai
from flask import current_app

logger = logging.getLogger(__name__)


class QualityScorer:
    """Evaluates and scores AI-generated answers."""
    
    # Quality dimensions and weights
    DIMENSIONS = {
        'completeness': 0.25,    # Does it answer the full question?
        'accuracy': 0.25,        # Is the information correct?
        'clarity': 0.20,         # Is it well-written and clear?
        'relevance': 0.15,       # Is it relevant to the question?
        'professionalism': 0.15, # Is the tone appropriate for RFPs?
    }
    
    def __init__(self):
        self.ai_enabled = bool(current_app.config.get('GOOGLE_API_KEY'))
        if self.ai_enabled:
            genai.configure(api_key=current_app.config['GOOGLE_API_KEY'])
            self.model = genai.GenerativeModel(
                current_app.config.get('GOOGLE_MODEL', 'gemini-1.5-pro')
            )
    
    def score_answer(
        self,
        question: str,
        answer: str,
        sources: List[Dict] = None
    ) -> Dict:
        """
        Score an answer across multiple quality dimensions.
        
        Returns:
            Dict with overall_score, dimension_scores, and suggestions
        """
        # Basic validation
        if not answer or len(answer.strip()) < 10:
            return {
                'overall_score': 0.0,
                'dimension_scores': {d: 0.0 for d in self.DIMENSIONS},
                'suggestions': ['Answer is too short or empty'],
                'flags': ['insufficient_content']
            }
        
        # Rule-based scoring
        rule_scores = self._rule_based_scoring(question, answer)
        
        # AI-based scoring if enabled
        if self.ai_enabled:
            ai_scores = self._ai_scoring(question, answer, sources)
            # Blend scores (60% AI, 40% rules)
            dimension_scores = {}
            for dim in self.DIMENSIONS:
                dimension_scores[dim] = (
                    0.6 * ai_scores['dimension_scores'].get(dim, 0.5) +
                    0.4 * rule_scores['dimension_scores'].get(dim, 0.5)
                )
            suggestions = ai_scores.get('suggestions', [])
        else:
            dimension_scores = rule_scores['dimension_scores']
            suggestions = rule_scores.get('suggestions', [])
        
        # Calculate weighted overall score
        overall_score = sum(
            dimension_scores[dim] * weight
            for dim, weight in self.DIMENSIONS.items()
        )
        
        # Identify flags
        flags = []
        if overall_score < 0.5:
            flags.append('low_quality')
        if dimension_scores.get('accuracy', 1) < 0.6:
            flags.append('accuracy_concern')
        if len(answer) > 2000:
            flags.append('too_verbose')
        
        return {
            'overall_score': round(overall_score, 3),
            'dimension_scores': {k: round(v, 3) for k, v in dimension_scores.items()},
            'suggestions': suggestions,
            'flags': flags
        }
    
    def _rule_based_scoring(self, question: str, answer: str) -> Dict:
        """Apply rule-based heuristics for scoring."""
        scores = {}
        suggestions = []
        
        # Completeness: Does it address the question?
        question_words = set(question.lower().split())
        answer_words = set(answer.lower().split())
        overlap = len(question_words & answer_words) / max(len(question_words), 1)
        scores['completeness'] = min(0.5 + overlap, 1.0)
        
        if overlap < 0.3:
            suggestions.append('Consider addressing more aspects of the question')
        
        # Clarity: Sentence structure, length
        sentences = re.split(r'[.!?]+', answer)
        avg_sentence_len = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
        if 10 <= avg_sentence_len <= 25:
            scores['clarity'] = 0.8
        elif avg_sentence_len > 40:
            scores['clarity'] = 0.4
            suggestions.append('Consider breaking up long sentences')
        else:
            scores['clarity'] = 0.6
        
        # Relevance: Based on question-answer similarity
        scores['relevance'] = min(0.6 + overlap * 0.5, 1.0)
        
        # Professionalism: Check for informal language
        informal_patterns = ['gonna', 'wanna', 'kinda', 'basically', '!!!', 'lol']
        informal_count = sum(1 for p in informal_patterns if p.lower() in answer.lower())
        scores['professionalism'] = max(0.9 - (informal_count * 0.15), 0.3)
        
        if informal_count > 0:
            suggestions.append('Use more formal language for RFP responses')
        
        # Accuracy: Default to 0.7 (needs AI/source verification)
        scores['accuracy'] = 0.7
        
        return {
            'dimension_scores': scores,
            'suggestions': suggestions
        }
    
    def _ai_scoring(
        self,
        question: str,
        answer: str,
        sources: List[Dict] = None
    ) -> Dict:
        """Use AI to evaluate answer quality."""
        sources_text = ""
        if sources:
            sources_text = "\n".join([
                f"- {s.get('title', 'Source')}: {s.get('snippet', '')[:200]}"
                for s in sources[:5]
            ])
        
        prompt = f"""Evaluate this RFP answer on a 0-1 scale for each dimension.

Question: {question}

Answer: {answer}

{f'Available Sources: {sources_text}' if sources_text else ''}

Rate each dimension from 0.0 to 1.0:
- completeness: Does it fully answer the question?
- accuracy: Is the information correct and verifiable?
- clarity: Is it well-written and easy to understand?
- relevance: Does it stay on topic?
- professionalism: Is the tone appropriate for business?

Also provide 1-3 specific suggestions for improvement.

Respond in this exact format:
COMPLETENESS: [0.0-1.0]
ACCURACY: [0.0-1.0]
CLARITY: [0.0-1.0]
RELEVANCE: [0.0-1.0]
PROFESSIONALISM: [0.0-1.0]
SUGGESTIONS:
- [suggestion 1]
- [suggestion 2]"""

        try:
            response = self.model.generate_content(prompt)
            return self._parse_ai_response(response.text)
        except Exception as e:
            logger.error(f"AI scoring failed: {e}")
            return {'dimension_scores': {d: 0.7 for d in self.DIMENSIONS}, 'suggestions': []}
    
    def _parse_ai_response(self, response_text: str) -> Dict:
        """Parse AI model's scoring response."""
        scores = {}
        suggestions = []
        
        # Parse dimension scores
        for dim in self.DIMENSIONS:
            pattern = rf'{dim.upper()}:\s*([\d.]+)'
            match = re.search(pattern, response_text, re.IGNORECASE)
            if match:
                try:
                    scores[dim] = float(match.group(1))
                except ValueError:
                    scores[dim] = 0.7
            else:
                scores[dim] = 0.7
        
        # Parse suggestions
        suggestions_match = re.search(r'SUGGESTIONS:(.*?)(?=$|\n\n)', response_text, re.DOTALL)
        if suggestions_match:
            lines = suggestions_match.group(1).strip().split('\n')
            for line in lines:
                clean = line.strip().lstrip('-').strip()
                if clean and len(clean) > 5:
                    suggestions.append(clean)
        
        return {
            'dimension_scores': scores,
            'suggestions': suggestions[:3]
        }
    
    def suggest_improvements(
        self,
        question: str,
        answer: str,
        score_result: Dict
    ) -> List[str]:
        """Generate specific improvement suggestions based on scores."""
        suggestions = list(score_result.get('suggestions', []))
        dimension_scores = score_result.get('dimension_scores', {})
        
        # Add dimension-specific suggestions
        if dimension_scores.get('completeness', 1) < 0.6:
            suggestions.append('Expand the answer to cover all aspects of the question')
        
        if dimension_scores.get('clarity', 1) < 0.6:
            suggestions.append('Simplify sentence structure and use bullet points')
        
        if dimension_scores.get('relevance', 1) < 0.6:
            suggestions.append('Focus more directly on what the question is asking')
        
        return suggestions[:5]


def get_quality_scorer() -> QualityScorer:
    """Get quality scorer instance."""
    return QualityScorer()
