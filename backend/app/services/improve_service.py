"""
Answer Improvement Service.

Provides AI-powered suggestions and auto-improvement for answers.
"""
import logging
from typing import Dict, List, Optional
import google.generativeai as genai
from flask import current_app

logger = logging.getLogger(__name__)


class AnswerImprover:
    """Improves AI-generated answers based on feedback and quality scores."""
    
    IMPROVEMENT_MODES = {
        'expand': 'Add more detail and comprehensive coverage',
        'concise': 'Make the answer more concise and focused',
        'formal': 'Improve professional tone and language',
        'technical': 'Add more technical depth and specifics',
        'simplify': 'Simplify language for broader audience',
    }
    
    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self._provider = None
        self._legacy_model = None
        
        # Check for legacy Google API key
        self.ai_enabled = bool(current_app.config.get('GOOGLE_API_KEY')) or (org_id is not None)
    
    def _get_provider(self):
        """Get the LLM provider from database configuration (always reload)."""
        if self.org_id:
            try:
                from app.services.llm_service_helper import get_llm_provider
                self._provider = get_llm_provider(self.org_id, 'answer_generation')
            except Exception as e:
                logger.warning(f"Could not get dynamic provider: {e}")
                self._provider = None
        return self._provider
    
    def _get_legacy_model(self):
        """Fallback to legacy Google AI model."""
        if self._legacy_model is None and current_app.config.get('GOOGLE_API_KEY'):
            import google.generativeai as genai
            genai.configure(api_key=current_app.config['GOOGLE_API_KEY'])
            self._legacy_model = genai.GenerativeModel(
                current_app.config.get('GOOGLE_MODEL', 'gemini-1.5-pro')
            )
        return self._legacy_model
    
    def _generate(self, prompt: str) -> str:
        """Generate content using configured provider."""
        # Try dynamic provider first
        provider = self._get_provider()
        if provider:
            try:
                return provider.generate_content(prompt)
            except Exception as e:
                logger.warning(f"Dynamic provider failed: {e}")
        
        # Fallback to legacy
        model = self._get_legacy_model()
        if model:
            response = model.generate_content(prompt)
            return response.text
        
        raise RuntimeError("No AI provider available")
    
    def auto_improve(
        self,
        question: str,
        current_answer: str,
        quality_scores: Dict,
        knowledge_context: str = None
    ) -> Dict:
        """
        Automatically improve an answer based on quality scores.
        
        Returns:
            Dict with improved_answer, changes_made, and confidence
        """
        if not self.ai_enabled:
            return {
                'improved_answer': current_answer,
                'changes_made': [],
                'confidence': 0.0,
                'error': 'AI not configured'
            }
        
        # Determine what needs improvement
        dimension_scores = quality_scores.get('dimension_scores', {})
        improvements_needed = []
        
        if dimension_scores.get('completeness', 1) < 0.7:
            improvements_needed.append('completeness')
        if dimension_scores.get('clarity', 1) < 0.7:
            improvements_needed.append('clarity')
        if dimension_scores.get('professionalism', 1) < 0.7:
            improvements_needed.append('professionalism')
        
        if not improvements_needed:
            return {
                'improved_answer': current_answer,
                'changes_made': [],
                'confidence': 0.9,
                'message': 'Answer already meets quality standards'
            }
        
        prompt = self._build_improvement_prompt(
            question, current_answer, improvements_needed, knowledge_context
        )
        
        try:
            improved_answer = self._generate(prompt).strip()
            
            # Clean up any meta-commentary
            if improved_answer.startswith('Here'):
                lines = improved_answer.split('\n')
                improved_answer = '\n'.join(lines[1:]).strip()
            
            return {
                'improved_answer': improved_answer,
                'changes_made': improvements_needed,
                'confidence': 0.85,
                'original_length': len(current_answer),
                'new_length': len(improved_answer)
            }
        except Exception as e:
            logger.error(f"Answer improvement failed: {e}")
            return {
                'improved_answer': current_answer,
                'changes_made': [],
                'confidence': 0.0,
                'error': str(e)
            }
    
    def improve_with_mode(
        self,
        question: str,
        current_answer: str,
        mode: str,
        knowledge_context: str = None
    ) -> Dict:
        """
        Improve answer with a specific improvement mode.
        
        Args:
            mode: One of 'expand', 'concise', 'formal', 'technical', 'simplify'
        """
        if mode not in self.IMPROVEMENT_MODES:
            return {
                'error': f'Invalid mode. Choose from: {list(self.IMPROVEMENT_MODES.keys())}'
            }
        
        if not self.ai_enabled:
            return {'error': 'AI not configured'}
        
        mode_instruction = self.IMPROVEMENT_MODES[mode]
        
        prompt = f"""Improve this RFP answer with the following goal: {mode_instruction}

Question: {question}

Current Answer:
{current_answer}

{f'Knowledge Context: {knowledge_context[:2000]}' if knowledge_context else ''}

Provide only the improved answer, with no preamble or explanation."""

        try:
            result = self._generate(prompt)
            return {
                'improved_answer': result.strip(),
                'mode': mode,
                'confidence': 0.8
            }
        except Exception as e:
            return {'error': str(e)}
    
    def regenerate_with_context(
        self,
        question: str,
        current_answer: str,
        additional_context: str,
        feedback: str = None
    ) -> Dict:
        """
        Regenerate answer incorporating new context or feedback.
        """
        if not self.ai_enabled:
            return {'error': 'AI not configured'}
        
        prompt = f"""Generate an improved RFP answer incorporating the new context.

Question: {question}

Previous Answer:
{current_answer}

Additional Context to incorporate:
{additional_context}

{f'User Feedback: {feedback}' if feedback else ''}

Generate a new, improved answer that:
1. Incorporates the new context naturally
2. Maintains professional RFP tone
3. Is complete and comprehensive
4. Directly addresses the question

Provide only the answer, no preamble."""

        try:
            result = self._generate(prompt)
            return {
                'regenerated_answer': result.strip(),
                'context_incorporated': True,
                'confidence': 0.85
            }
        except Exception as e:
            return {'error': str(e)}
    
    def _build_improvement_prompt(
        self,
        question: str,
        answer: str,
        improvements: List[str],
        context: str = None
    ) -> str:
        """Build the improvement prompt based on needed improvements."""
        improvement_instructions = []
        
        if 'completeness' in improvements:
            improvement_instructions.append(
                "- Add more detail to fully address all aspects of the question"
            )
        if 'clarity' in improvements:
            improvement_instructions.append(
                "- Improve clarity with better structure and simpler sentences"
            )
        if 'professionalism' in improvements:
            improvement_instructions.append(
                "- Enhance professional tone suitable for business proposals"
            )
        if 'accuracy' in improvements:
            improvement_instructions.append(
                "- Verify and correct any inaccurate information"
            )
        
        return f"""Improve this RFP answer with the following goals:
{chr(10).join(improvement_instructions)}

Question: {question}

Current Answer:
{answer}

{f'Reference Knowledge: {context[:2000]}' if context else ''}

Provide only the improved answer, with no preamble or explanation.
Maintain the same general structure but enhance the content."""


def get_answer_improver() -> AnswerImprover:
    """Get answer improver instance."""
    return AnswerImprover()
