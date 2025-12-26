"""
Question Extraction Service

Extracts questions from parsed document text using pattern matching
and AI-powered extraction via dynamic LLM configuration.
"""
import re
import logging
from typing import List, Dict, Optional
from flask import current_app

logger = logging.getLogger(__name__)


class QuestionExtractor:
    """Extracts questions from document text."""
    
    # Common question patterns in RFPs
    QUESTION_PATTERNS = [
        # Direct questions
        r'(?:^|\n)\s*(?:\d+[\.]\s*)?([A-Z][^.?!]*\?)\s*(?:\n|$)',
        # Numbered items with question words
        r'(?:^|\n)\s*(?:\d+[\.]\s*)((?:What|How|Why|When|Where|Who|Which|Can|Does|Do|Is|Are|Will|Would|Could|Should|Please describe|Please explain|Please provide)[^.?!]*[.?])',
        # Section headers that are questions
        r'(?:^|\n)\s*(?:[A-Z\d]+[\.]\s*)(.*?\?)\s*(?:\n|$)',
        # "Please" statements (common in questionnaires)
        r'(?:^|\n)\s*(?:\d+[\.]\s*)?(Please (?:describe|explain|provide|list|detail|indicate|specify)[^.?!]*\.)',
        # Requirement statements
        r'(?:^|\n)\s*(?:\d+[\.]\s*)?((?:Describe|Explain|Provide|List|Detail)[^.?!]*\.)',
    ]
    
    # Section header patterns
    SECTION_PATTERNS = [
        r'(?:^|\n)(?:[\d\.]+\s+)?([A-Z][A-Z\s]+)(?:\n|$)',  # ALL CAPS headers
        r'(?:^|\n)Section\s+(\d+)[\.:\s]+([^\n]+)',  # "Section X: Title"
        r'(?:^|\n)(?:Part|Chapter)\s+(\d+|[IVX]+)[\.:\s]+([^\n]+)',  # "Part/Chapter X: Title"
    ]


    def __init__(self, org_id: int = None):
        """Initialize the extractor with dynamic LLM provider."""
        self.org_id = org_id
        self._llm_provider = None
        self._legacy_model = None
        self.ai_enabled = False
        
        # Try to get dynamic LLM provider
        if org_id:
            try:
                from app.services.llm_service_helper import get_llm_provider
                self._llm_provider = get_llm_provider(org_id, 'question_extractor')
                if self._llm_provider:
                    self.ai_enabled = True
                    logger.info(f"QuestionExtractor using dynamic provider: {self._llm_provider.provider_name}")
            except Exception as e:
                logger.warning(f"Could not load dynamic LLM provider: {e}")
        
        # Fallback to legacy if no dynamic provider
        if not self.ai_enabled:
            self._init_legacy_model()
    
    def _init_legacy_model(self):
        """Initialize legacy Google model as fallback."""
        try:
            api_key = current_app.config.get('GOOGLE_API_KEY')
            if api_key:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                self._legacy_model = genai.GenerativeModel(
                    current_app.config.get('GOOGLE_MODEL', 'gemini-1.5-flash')
                )
                self.ai_enabled = True
                logger.info("QuestionExtractor using legacy Google provider")
        except Exception as e:
            logger.warning(f"Legacy model init failed: {e}")
            self._legacy_model = None
    
    def _generate(self, prompt: str) -> str:
        """Generate content using configured provider."""
        if self._llm_provider:
            return self._llm_provider.generate_content(prompt)
        elif self._legacy_model:
            response = self._legacy_model.generate_content(prompt)
            return response.text
        else:
            raise Exception("No LLM provider available")

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
        
        # CLEAN AND FILTER questions
        questions = self._clean_questions(questions)
        
        # Sort and assign order
        for i, q in enumerate(questions, 1):
            q['order'] = i
        
        return questions
    
    def _clean_questions(self, questions: List[Dict]) -> List[Dict]:
        """
        Clean and filter questions to remove garbage text.
        - Remove form field metadata and table headers
        - Remove 'Service provider's answer' prefix
        - Remove hash IDs and technical codes
        - Filter out non-questions (too short, no real content)
        """
        # Patterns that indicate garbage/metadata (not real questions)
        garbage_patterns = [
            r'bool_label',
            r'bool_code',
            r'[a-f0-9]{32}',  # MD5-like hashes
            r'\b(True|False)\b.*\b(True|False)\b',  # Boolean options
            r'Code\s*\|\s*Field\s*Label',  # Table headers
            r'Description\s*/\s*Instructional\s*Text',
            r'Required\s*\|\s*Answer\s*\|\s*Comment',
            r'Upload\s*attachments\?',
            r'^\s*(Yes|No)\s*$',  # Just Yes/No
            r'^\s*\d+\s*\|\s*\d+\s*$',  # Just numbers with pipe
            r'RFI\s*\|\s*Scoring',  # RFI scoring headers
            r'Transport\s*\|\s*\d+\s*\|\s*\d+',  # Transport scoring
        ]
        
        # Prefixes to remove (more flexible patterns)
        remove_prefixes = [
            r"Service\s*provider'?s?\s*answer\s*:?\s*",  # Service provider's answer
            r"Vendor'?s?\s*response\s*:?\s*",  # Vendor response
            r"^Answer\s*:?\s*",  # Answer:
            r"^Response\s*:?\s*",  # Response:
            r"Provider'?s?\s*answer\s*:?\s*",  # Provider's answer
        ]

        
        cleaned = []
        for q in questions:
            text = q['text']
            
            # Skip if matches garbage pattern
            is_garbage = False
            for pattern in garbage_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    is_garbage = True
                    break
            
            if is_garbage:
                continue
            
            # Remove unwanted prefixes
            for prefix in remove_prefixes:
                text = re.sub(prefix, '', text, flags=re.IGNORECASE).strip()
            
            # Clean up multiple pipes (table artifacts)
            text = re.sub(r'\s*\|\s*', ' ', text)
            
            # Clean up multiple spaces
            text = re.sub(r'\s+', ' ', text).strip()
            
            # Skip if too short after cleaning
            if len(text) < 15:
                continue
            
            # Skip if mostly numbers/special chars (not a real question)
            alpha_ratio = sum(c.isalpha() for c in text) / len(text) if text else 0
            if alpha_ratio < 0.5:
                continue
            
            # Skip if it's just a field label without question content
            if text.count('|') > 3:
                continue
            
            q['text'] = text
            cleaned.append(q)
        
        return cleaned


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
{text[:15000]}

Extract ALL questions, requirements, and information requests. Include:
- Direct questions (marked with ?)
- Requests for information (e.g., "Please describe...")
- Requirements that need a response
- Numbered items that expect answers"""

        try:
            response_text = self._generate(prompt)
            return self._parse_ai_response(response_text)
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


# Singleton instance getter with org_id support
def get_extractor(org_id: int = None) -> QuestionExtractor:
    """Get question extractor instance."""
    return QuestionExtractor(org_id=org_id)
