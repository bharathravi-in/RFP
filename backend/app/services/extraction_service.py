"""
Question Extraction Service

Extracts questions from parsed document text using pattern matching
and AI-powered extraction via Google Gemini.
"""
import re
import logging
from typing import List, Dict, Optional
import google.generativeai as genai
from flask import current_app

logger = logging.getLogger(__name__)


class QuestionExtractor:
    """Extracts questions from document text."""
    
    # Common question patterns in RFPs
    QUESTION_PATTERNS = [
        # Direct questions
        r'(?:^|\n)\s*(?:\d+[\.\)]\s*)?([A-Z][^.?!]*\?)\s*(?:\n|$)',
        # Numbered items with question words
        r'(?:^|\n)\s*(?:\d+[\.\)]\s*)((?:What|How|Why|When|Where|Who|Which|Can|Does|Do|Is|Are|Will|Would|Could|Should|Please describe|Please explain|Please provide)[^.?!]*[.?])',
        # Section headers that are questions
        r'(?:^|\n)\s*(?:[A-Z\d]+[\.\)]\s*)(.*?\?)\s*(?:\n|$)',
        # "Please" statements (common in questionnaires)
        r'(?:^|\n)\s*(?:\d+[\.\)]\s*)?(Please (?:describe|explain|provide|list|detail|indicate|specify)[^.?!]*\.)',
        # Requirement statements
        r'(?:^|\n)\s*(?:\d+[\.\)]\s*)?((?:Describe|Explain|Provide|List|Detail)[^.?!]*\.)',
    ]
    
    # Section header patterns
    SECTION_PATTERNS = [
        r'(?:^|\n)(?:[\d\.]+\s+)?([A-Z][A-Z\s]+)(?:\n|$)',  # ALL CAPS headers
        r'(?:^|\n)Section\s+(\d+)[\.:]\s*([^\n]+)',  # "Section X: Title"
        r'(?:^|\n)(?:Part|Chapter)\s+(\d+|[IVX]+)[\.:]\s*([^\n]+)',  # "Part/Chapter X: Title"
    ]

    def __init__(self):
        """Initialize the extractor with AI model if available."""
        self.ai_enabled = bool(current_app.config.get('GOOGLE_API_KEY'))
        if self.ai_enabled:
            genai.configure(api_key=current_app.config['GOOGLE_API_KEY'])
            self.model = genai.GenerativeModel(
                current_app.config.get('GOOGLE_MODEL', 'gemini-1.5-pro')
            )

    def extract_questions(
        self,
        text: str,
        use_ai: bool = True
    ) -> List[Dict]:
        """
        Extract questions from document text.
        
        Args:
            text: The document text to extract from
            use_ai: Whether to use AI for enhanced extraction
            
        Returns:
            List of question dicts with text, section, order
        """
        questions = []
        
        # Pattern-based extraction
        pattern_questions = self._pattern_extraction(text)
        questions.extend(pattern_questions)
        
        # AI-enhanced extraction if enabled
        if use_ai and self.ai_enabled and len(questions) < 5:
            ai_questions = self._ai_extraction(text)
            # Merge and deduplicate
            questions = self._merge_questions(questions, ai_questions)
        
        # Sort and assign order
        for i, q in enumerate(questions, 1):
            q['order'] = i
        
        return questions

    def _pattern_extraction(self, text: str) -> List[Dict]:
        """Extract questions using regex patterns."""
        questions = []
        current_section = 'General'
        
        # Find sections first
        sections = self._extract_sections(text)
        
        for pattern in self.QUESTION_PATTERNS:
            matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
            for match in matches:
                question_text = match.strip() if isinstance(match, str) else match[0].strip()
                
                if len(question_text) < 10:  # Skip very short matches
                    continue
                    
                # Find which section this question belongs to
                section = self._find_section(text, question_text, sections)
                
                questions.append({
                    'text': question_text,
                    'section': section or current_section,
                    'source': 'pattern',
                })
        
        # Deduplicate
        seen = set()
        unique = []
        for q in questions:
            normalized = q['text'].lower().strip()
            if normalized not in seen:
                seen.add(normalized)
                unique.append(q)
        
        return unique

    def _ai_extraction(self, text: str) -> List[Dict]:
        """Use AI to extract questions from complex documents."""
        if not self.ai_enabled:
            return []
        
        prompt = f"""Extract all questions and information requests from this RFP/questionnaire document.

For each question found, return it in this exact format:
SECTION: [section name]
QUESTION: [the question text]
---

Document text:
{text[:15000]}  # Limit for API

Extract ALL questions, requirements, and information requests. Include:
- Direct questions (marked with ?)
- Requests for information (e.g., "Please describe...")
- Requirements that need a response
- Numbered items that expect answers"""

        try:
            response = self.model.generate_content(prompt)
            return self._parse_ai_response(response.text)
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            return []

    def _parse_ai_response(self, response_text: str) -> List[Dict]:
        """Parse the AI model's response into question dicts."""
        questions = []
        current_section = 'General'
        
        blocks = response_text.split('---')
        
        for block in blocks:
            if not block.strip():
                continue
                
            section_match = re.search(r'SECTION:\s*(.+)', block, re.IGNORECASE)
            question_match = re.search(r'QUESTION:\s*(.+)', block, re.IGNORECASE | re.DOTALL)
            
            if section_match:
                current_section = section_match.group(1).strip()
            
            if question_match:
                question_text = question_match.group(1).strip()
                # Clean up multi-line questions
                question_text = ' '.join(question_text.split())
                
                if len(question_text) >= 10:
                    questions.append({
                        'text': question_text,
                        'section': current_section,
                        'source': 'ai',
                    })
        
        return questions

    def _extract_sections(self, text: str) -> List[Dict]:
        """Extract section headers from document."""
        sections = []
        
        for pattern in self.SECTION_PATTERNS:
            for match in re.finditer(pattern, text):
                start = match.start()
                name = match.group(1) if len(match.groups()) == 1 else f"{match.group(1)}: {match.group(2)}"
                sections.append({
                    'name': name.strip(),
                    'position': start,
                })
        
        # Sort by position
        sections.sort(key=lambda x: x['position'])
        return sections

    def _find_section(
        self,
        text: str,
        question: str,
        sections: List[Dict]
    ) -> Optional[str]:
        """Find which section a question belongs to."""
        try:
            pos = text.index(question)
        except ValueError:
            return None
        
        current_section = None
        for section in sections:
            if section['position'] <= pos:
                current_section = section['name']
            else:
                break
        
        return current_section

    def _merge_questions(
        self,
        pattern_questions: List[Dict],
        ai_questions: List[Dict]
    ) -> List[Dict]:
        """Merge pattern and AI extracted questions, removing duplicates."""
        merged = pattern_questions.copy()
        seen = {q['text'].lower().strip() for q in pattern_questions}
        
        for q in ai_questions:
            normalized = q['text'].lower().strip()
            # Check for similar questions (not exact match)
            is_duplicate = False
            for existing in seen:
                if self._similarity(normalized, existing) > 0.8:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                merged.append(q)
                seen.add(normalized)
        
        return merged

    def _similarity(self, s1: str, s2: str) -> float:
        """Calculate simple similarity ratio between strings."""
        if not s1 or not s2:
            return 0.0
        
        # Simple word overlap similarity
        words1 = set(s1.split())
        words2 = set(s2.split())
        
        if not words1 or not words2:
            return 0.0
        
        overlap = len(words1 & words2)
        return 2 * overlap / (len(words1) + len(words2))


# Singleton instance getter
def get_extractor() -> QuestionExtractor:
    """Get question extractor instance."""
    return QuestionExtractor()
