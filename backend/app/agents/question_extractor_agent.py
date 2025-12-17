"""
Question Extractor Agent

Extracts and classifies questions from RFP documents.
"""
import logging
import json
import re
from typing import Dict, List, Any

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig  # NEW

logger = logging.getLogger(__name__)


class QuestionExtractorAgent:
    """
    Agent that extracts questions from RFP documents.
    - Identifies question patterns
    - Classifies by category
    - Prioritizes by importance
    """
    
    EXTRACTION_PROMPT = """You are an expert at analyzing RFP documents. Your task is to extract ALL questions and requirements that need vendor responses.

**CRITICAL: WHAT TO EXTRACT vs WHAT TO IGNORE**

✅ **EXTRACT THESE:**
- Questions from the RFP issuer/buyer asking vendors to respond
- Requirements that need vendor confirmation or description
- Requests for information from vendors
- Items in vendor response sections that are BLANK or need filling

❌ **DO NOT EXTRACT THESE:**
- Example answers or sample responses
- Service provider's previous answers or responses
- Content labeled as "Vendor Response:", "Answer:", "Response:", "Example:"
- Pre-filled answers or completed sections
- Narrative text explaining what vendors should do
- Instructions or guidelines (unless they contain a specific question)

**IMPORTANT EXTRACTION RULES:**
1. Extract EVERY question that needs a NEW vendor response
2. SKIP any text that appears to be an existing answer or example
3. Look for questions in these forms:
   - Direct questions ending with "?"
   - Imperative statements: "Provide...", "Describe...", "Explain...", "List..."
   - Requirements phrased as: "The vendor must/shall/should..."
   - Checkbox or form-style items requiring responses
   - Tables or matrices requiring completion
   - "Please confirm...", "Indicate whether..."

4. For each question, identify:
   - The EXACT text (preserve original wording)
   - Category (security, compliance, technical, pricing, legal, product, support, integration, general)
   - Whether it's mandatory (must, shall, required) or optional (should, may, preferred)
   - Priority based on context and language strength
   - Which section it belongs to

**CATEGORIES EXPLAINED:**
- security: Authentication, encryption, access control, data protection
- compliance: Regulatory (GDPR, HIPAA, SOC2), certifications, audits
- technical: Architecture, APIs, integrations, performance, scalability
- pricing: Costs, fees, payment terms, discounts
- legal: Contracts, liability, warranties, terms
- product: Features, functionality, roadmap
- support: Maintenance, SLAs, training, documentation
- integration: Third-party systems, data migration, APIs
- general: Company info, references, experience

**RESPOND WITH VALID JSON ONLY:**
{{
  "questions": [
    {{
      "id": 1,
      "text": "Exact question text from document",
      "category": "security|compliance|technical|pricing|legal|product|support|integration|general",
      "mandatory": true,
      "priority": "critical|high|medium|low",
      "section_reference": "Section name or null",
      "question_type": "direct|imperative|requirement|checkbox|table"
    }}
  ],
  "total_count": 0,
  "category_breakdown": {{
    "security": 0,
    "compliance": 0,
    "technical": 0,
    "pricing": 0,
    "legal": 0,
    "product": 0,
    "support": 0,
    "integration": 0,
    "general": 0
  }},
  "mandatory_count": 0,
  "optional_count": 0
}}

**DOCUMENT TEXT:**
{text}

Return ONLY valid JSON, no markdown formatting or code blocks."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='rfp_analysis')
        self.name = "QuestionExtractorAgent"
    
    def extract(self, document_text: str = None, session_state: Dict = None) -> Dict:
        """
        Extract questions from the document.
        
        Args:
            document_text: Optional document text (uses session state if not provided)
            session_state: Shared state with document text and structure
            
        Returns:
            Extracted questions with classifications
        """
        session_state = session_state or {}
        
        # Get document text from session or parameter
        text = document_text or session_state.get(SessionKeys.DOCUMENT_TEXT, "")
        if not text:
            return {"success": False, "error": "No document text available"}
        
        # Get document structure for context
        doc_structure = session_state.get(SessionKeys.DOCUMENT_STRUCTURE, {})
        
        try:
            result = self._extract_with_ai(text, doc_structure)
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            result = self._fallback_extraction(text)
        
        # Store in session state for other agents
        session_state[SessionKeys.EXTRACTED_QUESTIONS] = result.get("questions", [])
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "questions_extracted",
            "summary": f"Extracted {result.get('total_count', 0)} questions"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "questions": result.get("questions", []),
            "total_count": result.get("total_count", 0),
            "category_breakdown": result.get("category_breakdown", {}),
            "session_state": session_state
        }
    
    @with_retry(
        config=RetryConfig(max_attempts=3, initial_delay=1.0),
        fallback_models=['gemini-1.5-pro']
    )
    def _extract_with_ai(self, text: str, doc_structure: Dict) -> Dict:
        """Use AI to extract questions."""
        client = self.config.client
        if not client:
            return self._fallback_extraction(text)
        
        prompt = self.EXTRACTION_PROMPT.format(text=text[:25000])
        
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
            logger.error(f"AI extraction error: {e}")
            return self._fallback_extraction(text)
    
    def _fallback_extraction(self, text: str) -> Dict:
        """Pattern-based question extraction fallback."""
        questions = []
        
        # Patterns to identify answer/response sections (to skip)
        answer_indicators = [
            r'(?:vendor|service provider|supplier)\s+(?:response|answer)',
            r'(?:response|answer|example):\s*',
            r'(?:sample|example)\s+(?:response|answer)',
            r'completed\s+by',
            r'answered\s+by'
        ]
        
        # Question patterns
        patterns = [
            r'(?:^|\n)\s*\d+[\.\)]\s*(.+\?)',  # Numbered questions
            r'(?:^|\n)\s*[a-z][\.\)]\s*(.+\?)',  # Lettered questions
            r'(?:Please|Provide|Describe|Explain|List)\s+(.+?)(?:\.|$)',  # Imperatives
            r'(?:What|How|When|Where|Why|Which|Can|Does|Will|Is)\s+(.+\?)',  # Question words
        ]
        
        seen = set()
        question_id = 1
        
        # Split text into lines for context checking
        lines = text.split('\n')
        
        for i, line in enumerate(lines):
            # Skip if line appears to be in an answer section
            line_lower = line.lower()
            if any(re.search(pattern, line_lower, re.IGNORECASE) for pattern in answer_indicators):
                continue
            
            # Check context (previous 2 lines) for answer indicators
            context_start = max(0, i - 2)
            context = ' '.join(lines[context_start:i+1]).lower()
            if any(re.search(pattern, context, re.IGNORECASE) for pattern in answer_indicators):
                continue
            
            # Try to match question patterns
            for pattern in patterns:
                matches = re.findall(pattern, line, re.IGNORECASE)
                for match in matches:
                    match = match.strip()
                    # Filter out very short or very long matches
                    if 20 < len(match) < 500 and match not in seen:
                        # Additional check: skip if it looks like an answer (contains lots of detail)
                        if match.count('.') > 3 or match.count(',') > 5:
                            continue
                        
                        seen.add(match)
                        category = self._guess_category(match)
                        questions.append({
                            "id": question_id,
                            "text": match,
                            "category": category,
                            "mandatory": True,
                            "priority": "medium",
                            "section_reference": None
                        })
                        question_id += 1
        
        # Build category breakdown
        category_breakdown = {}
        for q in questions:
            cat = q["category"]
            category_breakdown[cat] = category_breakdown.get(cat, 0) + 1
        
        return {
            "questions": questions[:100],  # Limit
            "total_count": len(questions),
            "category_breakdown": category_breakdown
        }
    
    def _guess_category(self, text: str) -> str:
        """Guess question category based on keywords."""
        text_lower = text.lower()
        
        categories = {
            'security': ['security', 'encrypt', 'access', 'authentication', 'password'],
            'compliance': ['compliance', 'regulatory', 'audit', 'gdpr', 'hipaa'],
            'technical': ['technical', 'api', 'integration', 'architecture', 'system'],
            'pricing': ['price', 'cost', 'fee', 'budget', 'payment'],
            'legal': ['legal', 'contract', 'liability', 'indemnity', 'warranty'],
            'product': ['feature', 'functionality', 'capability', 'product'],
        }
        
        for category, keywords in categories.items():
            if any(kw in text_lower for kw in keywords):
                return category
        
        return 'general'


def get_question_extractor_agent() -> QuestionExtractorAgent:
    """Factory function to get Question Extractor Agent."""
    return QuestionExtractorAgent()
