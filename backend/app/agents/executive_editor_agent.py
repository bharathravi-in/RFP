"""
Executive Editor Agent

Transforms technical content into CXO-ready language.
Ensures executive-appropriate tone, storytelling, and value proposition framing.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class ExecutiveEditorAgent:
    """
    Agent that elevates proposal content to executive-grade quality.
    
    Responsibilities:
    - Tone elevation to CXO-level language
    - Jargon simplification
    - Value proposition highlighting
    - Storytelling enhancement
    - Readability scoring and improvement
    - Executive summary generation
    """
    
    # Readability targets
    READABILITY_TARGETS = {
        'flesch_reading_ease': 60,  # 60-70 is ideal for business writing
        'grade_level': 10,  # 10th grade reading level
        'sentence_length': 20,  # Average words per sentence
        'paragraph_length': 100  # Average words per paragraph
    }
    
    # Jargon to simplify
    JARGON_REPLACEMENTS = {
        'leverage': 'use',
        'utilize': 'use',
        'facilitate': 'help',
        'implement': 'set up',
        'optimize': 'improve',
        'synergy': 'collaboration',
        'paradigm': 'approach',
        'holistic': 'complete',
        'scalable': 'can grow with your needs',
        'robust': 'strong',
        'seamless': 'smooth',
        'cutting-edge': 'modern',
        'best-in-class': 'leading',
        'mission-critical': 'essential',
        'state-of-the-art': 'advanced',
        'end-to-end': 'complete',
        'value-add': 'benefit',
        'bandwidth': 'capacity',
        'deep-dive': 'detailed analysis',
        'low-hanging fruit': 'quick wins',
    }
    
    # Value proposition keywords to highlight
    VALUE_KEYWORDS = [
        'reduce cost', 'increase revenue', 'save time', 'improve efficiency',
        'minimize risk', 'accelerate', 'streamline', 'enhance', 'transform',
        'competitive advantage', 'ROI', 'return on investment', 'business value'
    ]
    
    EXECUTIVE_EDIT_PROMPT = """You are a Senior Executive Communications Editor reviewing proposal content for C-suite consumption.

## Original Content
{original_content}

## Editing Requirements

Transform this content to be executive-ready by:

1. **Tone Elevation**: Shift from technical to strategic business language
2. **Jargon Reduction**: Replace complex terms with clear business language
3. **Value Focus**: Lead with business outcomes, not features
4. **Confidence**: Use confident, authoritative language (avoid hedging)
5. **Brevity**: Eliminate filler words and redundancy
6. **Impact**: Front-load key messages and value propositions
7. **Storytelling**: Frame as business narrative, not technical description

## Executive Writing Rules
- Lead with the "so what?" - why should an executive care?
- Use active voice
- Quantify benefits when possible
- Avoid acronyms unless defined
- One idea per paragraph
- Maximum 3 sentences per paragraph for key points

## Response Format (JSON only)
{{
  "edited_content": "The executive-ready version of the content",
  "changes_made": [
    {{"type": "change_type", "original": "before", "edited": "after", "reason": "why changed"}}
  ],
  "readability_improvement": {{
    "before_grade_level": 0,
    "after_grade_level": 0,
    "before_flesch_score": 0,
    "after_flesch_score": 0
  }},
  "value_propositions_highlighted": ["list of value props made prominent"],
  "executive_summary": "2-3 sentence TL;DR for executives",
  "key_messages": ["top 3 takeaways for reader"],
  "confidence_score": 0.0-1.0
}}

Return ONLY valid JSON."""

    SUMMARY_PROMPT = """Generate a concise executive summary from the following proposal sections:

{sections_content}

Requirements:
- Maximum 250 words
- Lead with business value and outcomes
- Include key differentiators
- Mention timeline and investment level if applicable
- End with clear next step or call to action

Return ONLY the executive summary text, no JSON or formatting."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "ExecutiveEditorAgent"
        self.org_id = org_id
    
    def edit_for_executives(
        self,
        content: str,
        content_type: str = 'section',
        session_state: Dict = None
    ) -> Dict:
        """
        Edit content for executive consumption.
        
        Args:
            content: Original content to edit
            content_type: Type of content (section, answer, summary)
            session_state: Shared state
            
        Returns:
            Edited content with improvements
        """
        session_state = session_state or {}
        
        if not content:
            return {"success": False, "error": "No content to edit"}
        
        # Step 1: Calculate initial readability
        initial_stats = self._calculate_readability(content)
        
        # Step 2: Apply basic jargon replacement
        pre_processed = self._replace_jargon(content)
        
        # Step 3: AI-powered executive editing
        try:
            ai_result = self._ai_executive_edit(pre_processed)
        except Exception as e:
            logger.error(f"AI editing failed: {e}")
            ai_result = self._fallback_edit(pre_processed, initial_stats)
        
        # Step 4: Calculate final readability
        edited_content = ai_result.get('edited_content', pre_processed)
        final_stats = self._calculate_readability(edited_content)
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "content_edited",
            "summary": f"Readability improved: Grade {initial_stats['grade_level']:.1f} → {final_stats['grade_level']:.1f}"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "original_content": content,
            "edited_content": edited_content,
            "changes_made": ai_result.get('changes_made', []),
            "readability": {
                "before": initial_stats,
                "after": final_stats,
                "improved": final_stats['grade_level'] < initial_stats['grade_level']
            },
            "executive_summary": ai_result.get('executive_summary', ''),
            "key_messages": ai_result.get('key_messages', []),
            "value_propositions": ai_result.get('value_propositions_highlighted', []),
            "confidence_score": ai_result.get('confidence_score', 0.7),
            "session_state": session_state
        }
    
    def edit_proposal_sections(
        self,
        sections: List[Dict],
        session_state: Dict = None
    ) -> Dict:
        """
        Edit all proposal sections for executive readiness.
        
        Args:
            sections: List of proposal sections
            session_state: Shared state
            
        Returns:
            Edited sections with aggregate improvements
        """
        session_state = session_state or {}
        edited_sections = []
        total_improvements = []
        
        for section in sections:
            content = section.get('content', '')
            title = section.get('title', 'Untitled')
            
            if not content or len(content) < 50:
                edited_sections.append(section)
                continue
            
            try:
                result = self.edit_for_executives(content)
                
                edited_section = {
                    **section,
                    'content': result.get('edited_content', content),
                    'executive_edited': True,
                    'readability_grade': result.get('readability', {}).get('after', {}).get('grade_level', 0)
                }
                edited_sections.append(edited_section)
                
                if result.get('readability', {}).get('improved'):
                    total_improvements.append({
                        'section': title,
                        'improvement': result.get('readability', {})
                    })
                    
            except Exception as e:
                logger.error(f"Failed to edit section {title}: {e}")
                edited_sections.append(section)
        
        # Generate overall executive summary
        try:
            executive_summary = self._generate_executive_summary(edited_sections)
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            executive_summary = ""
        
        return {
            "success": True,
            "edited_sections": edited_sections,
            "sections_improved": len(total_improvements),
            "improvements": total_improvements,
            "executive_summary": executive_summary,
            "session_state": session_state
        }
    
    def _calculate_readability(self, text: str) -> Dict:
        """Calculate readability metrics for text."""
        if not text:
            return {'grade_level': 0, 'flesch_score': 0, 'avg_sentence_length': 0}
        
        # Basic sentence and word counting
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        sentence_count = max(len(sentences), 1)
        
        words = text.split()
        word_count = len(words)
        
        # Count syllables (approximate)
        syllables = sum(self._count_syllables(word) for word in words)
        
        # Flesch Reading Ease
        if word_count > 0 and sentence_count > 0:
            avg_sentence_length = word_count / sentence_count
            avg_syllables_per_word = syllables / word_count
            
            flesch_score = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
            flesch_score = max(0, min(100, flesch_score))
            
            # Flesch-Kincaid Grade Level
            grade_level = (0.39 * avg_sentence_length) + (11.8 * avg_syllables_per_word) - 15.59
            grade_level = max(0, min(20, grade_level))
        else:
            flesch_score = 50
            grade_level = 12
            avg_sentence_length = 0
        
        return {
            'grade_level': round(grade_level, 1),
            'flesch_score': round(flesch_score, 1),
            'avg_sentence_length': round(avg_sentence_length, 1),
            'word_count': word_count,
            'sentence_count': sentence_count
        }
    
    def _count_syllables(self, word: str) -> int:
        """Approximate syllable count for a word."""
        word = word.lower().strip('.,!?;:')
        if len(word) <= 3:
            return 1
        
        vowels = 'aeiouy'
        count = 0
        prev_vowel = False
        
        for char in word:
            is_vowel = char in vowels
            if is_vowel and not prev_vowel:
                count += 1
            prev_vowel = is_vowel
        
        # Adjust for common patterns
        if word.endswith('e'):
            count -= 1
        if word.endswith('le') and len(word) > 2 and word[-3] not in vowels:
            count += 1
        
        return max(1, count)
    
    def _replace_jargon(self, text: str) -> str:
        """Replace common jargon with simpler alternatives."""
        result = text
        for jargon, simple in self.JARGON_REPLACEMENTS.items():
            # Case-insensitive replacement preserving case
            pattern = re.compile(re.escape(jargon), re.IGNORECASE)
            result = pattern.sub(simple, result)
        return result
    
    def _ai_executive_edit(self, content: str) -> Dict:
        """Use AI to perform executive-level editing."""
        client = self.config.client
        if not client:
            return self._fallback_edit(content, {})
        
        prompt = self.EXECUTIVE_EDIT_PROMPT.format(original_content=content[:8000])
        
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
            logger.error(f"AI executive edit error: {e}")
            return self._fallback_edit(content, {})
    
    def _fallback_edit(self, content: str, initial_stats: Dict) -> Dict:
        """Fallback editing when AI is unavailable."""
        # Apply basic improvements
        edited = content
        
        # Remove filler phrases
        filler_patterns = [
            r'\bbasically\b',
            r'\bactually\b',
            r'\bin order to\b',
            r'\bdue to the fact that\b',
            r'\bit should be noted that\b',
            r'\bit is important to note that\b',
        ]
        
        for pattern in filler_patterns:
            edited = re.sub(pattern, '', edited, flags=re.IGNORECASE)
        
        # Clean up extra whitespace
        edited = re.sub(r'\s+', ' ', edited)
        edited = re.sub(r'\s+([.,!?])', r'\1', edited)
        
        return {
            'edited_content': edited.strip(),
            'changes_made': [{'type': 'filler_removal', 'reason': 'Removed filler phrases'}],
            'executive_summary': '',
            'key_messages': [],
            'value_propositions_highlighted': [],
            'confidence_score': 0.5
        }
    
    def _generate_executive_summary(self, sections: List[Dict]) -> str:
        """Generate executive summary from all sections."""
        client = self.config.client
        if not client:
            return ""
        
        # Build sections content
        content_parts = []
        for section in sections[:8]:
            title = section.get('title', '')
            content = section.get('content', '')[:1000]
            if content:
                content_parts.append(f"## {title}\n{content}")
        
        sections_content = "\n\n".join(content_parts)
        prompt = self.SUMMARY_PROMPT.format(sections_content=sections_content[:10000])
        
        try:
            if self.config.is_adk_enabled:
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=prompt
                )
                return response.text.strip()
            else:
                response = client.generate_content(prompt)
                return response.text.strip()
                
        except Exception as e:
            logger.error(f"Executive summary generation error: {e}")
            return ""

    def highlight_value_propositions(self, content: str) -> Dict:
        """Identify and highlight value propositions in content."""
        found = []
        for keyword in self.VALUE_KEYWORDS:
            if keyword.lower() in content.lower():
                found.append(keyword)
        
        return {
            'value_propositions_found': found,
            'count': len(found),
            'recommendation': 'Good value emphasis' if len(found) >= 3 else 'Consider adding more value-focused language'
        }


def get_executive_editor_agent(org_id: int = None) -> ExecutiveEditorAgent:
    """Factory function to get Executive Editor Agent."""
    return ExecutiveEditorAgent(org_id=org_id)
