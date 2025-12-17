"""
Document Analyzer Agent

Analyzes RFP document structure, themes, and requirements.
Communicates analysis results to other agents via session state.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig  # NEW

logger = logging.getLogger(__name__)


class DocumentAnalyzerAgent:
    """
    Agent that analyzes RFP documents to extract:
    - Document structure and sections
    - Key themes and focus areas
    - Requirements and evaluation criteria
    """
    
    ANALYSIS_PROMPT = """You are an expert RFP analyst. Carefully analyze this RFP (Request for Proposal) document and extract comprehensive information.

**INSTRUCTIONS:**
1. Read the entire document carefully before responding
2. Identify ALL sections, not just explicitly numbered ones
3. Look for implicit requirements stated as expectations or preferences
4. Note any specific formatting or response requirements
5. Identify key stakeholders and their concerns

**EXTRACT THE FOLLOWING:**

1. **Document Sections**: Identify EVERY distinct section including:
   - Title/name of each section
   - Main purpose (information, requirements, instructions, vendor response needed)
   - Whether it contains questions that need answers
   - Approximate position in document

2. **Key Themes**: Major focus areas such as:
   - Security, Compliance, Technical capability, Pricing/Cost
   - Integration requirements, Support/Maintenance, Innovation
   - Industry-specific concerns

3. **Requirements**: ALL requirements including:
   - Mandatory requirements (must, shall, required)
   - Preferred requirements (should, preferred, desired)
   - Priority level (critical, high, medium, low)

4. **Evaluation Criteria**: How responses will be scored

5. **Deliverables**: What the vendor must provide

6. **Timeline**: ALL dates and deadlines

7. **Questions to Answer**: Explicit questions requiring vendor response

**RESPOND WITH VALID JSON ONLY:**
{{
  "sections": [
    {{"name": "Section Name", "purpose": "What this section covers", "contains_questions": true/false, "position": "beginning/middle/end"}}
  ],
  "themes": ["theme1", "theme2"],
  "requirements": [
    {{"text": "Requirement text", "priority": "critical/high/medium/low", "mandatory": true/false, "category": "security/technical/pricing/compliance/general"}}
  ],
  "evaluation_criteria": ["How responses will be scored"],
  "deliverables": ["Expected deliverable"],
  "timeline": [{{"event": "Event name", "date": "Date if specified", "is_deadline": true/false}}],
  "questions_identified": [
    {{"text": "Question text", "section": "Section name", "requires_response": true}}
  ],
  "document_type": "rfp/rfq/rfi/questionnaire",
  "complexity_score": 0.0-1.0,
  "estimated_response_time_hours": 0,
  "issuing_organization": "Organization name if identified"
}}

**DOCUMENT TEXT:**
{text}

Return ONLY valid JSON, no markdown formatting or code blocks."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='rfp_analysis')
        self.name = "DocumentAnalyzerAgent"
    
    def analyze(self, document_text: str, session_state: Dict = None) -> Dict:
        """
        Analyze the RFP document.
        
        Args:
            document_text: Extracted text from the RFP document
            session_state: Shared state for agent communication
            
        Returns:
            Analysis results with structure, themes, requirements
        """
        session_state = session_state or {}
        
        # Store document text for other agents
        session_state[SessionKeys.DOCUMENT_TEXT] = document_text
        
        try:
            analysis = self._analyze_with_ai(document_text)
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            analysis = self._fallback_analysis(document_text)
        
        # Store analysis in session state for other agents
        session_state[SessionKeys.DOCUMENT_STRUCTURE] = analysis
        
        # Add agent message for logging
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "document_analyzed",
            "summary": f"Found {len(analysis.get('sections', []))} sections, {len(analysis.get('themes', []))} themes"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "analysis": analysis,
            "session_state": session_state
        }
    
    @with_retry(
        config=RetryConfig(max_attempts=3, initial_delay=1.0),
        fallback_models=['gemini-1.5-pro']
    )
    def _analyze_with_ai(self, text: str) -> Dict:
        """Use AI to analyze document structure."""
        client = self.config.client
        if not client:
            return self._fallback_analysis(text)
        
        prompt = self.ANALYSIS_PROMPT.format(text=text[:25000])
        
        try:
            if self.config.is_adk_enabled:
                from google import genai
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
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            return self._fallback_analysis(text)
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return self._fallback_analysis(text)
    
    def _fallback_analysis(self, text: str) -> Dict:
        """Pattern-based analysis fallback."""
        sections = []
        themes = []
        
        # Detect sections
        section_patterns = [
            r'(?:^|\n)(?:Section|Part|Chapter)\s+[\dIVX]+[:\.\s]+([^\n]+)',
            r'(?:^|\n)(\d+\.\s+[A-Z][^.\n]{10,50})',
        ]
        
        for pattern in section_patterns:
            matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
            for match in matches[:15]:
                sections.append({
                    "name": match.strip(),
                    "purpose": "Detected section",
                    "page_range": "N/A"
                })
        
        # Detect themes
        theme_keywords = {
            'security': ['security', 'authentication', 'encryption', 'access control'],
            'compliance': ['compliance', 'regulatory', 'gdpr', 'hipaa', 'sox'],
            'scalability': ['scalability', 'scale', 'growth', 'performance'],
            'integration': ['integration', 'api', 'interface', 'connect'],
            'support': ['support', 'maintenance', 'sla', 'uptime'],
            'pricing': ['pricing', 'cost', 'budget', 'fee'],
        }
        
        text_lower = text.lower()
        for theme, keywords in theme_keywords.items():
            if any(kw in text_lower for kw in keywords):
                themes.append(theme)
        
        return {
            "sections": sections,
            "themes": themes,
            "requirements": [],
            "evaluation_criteria": [],
            "deliverables": [],
            "timeline": [],
            "document_type": "rfp",
            "complexity_score": 0.5
        }


def get_document_analyzer_agent(org_id: int = None) -> DocumentAnalyzerAgent:
    """Factory function to get Document Analyzer Agent."""
    return DocumentAnalyzerAgent(org_id=org_id)
