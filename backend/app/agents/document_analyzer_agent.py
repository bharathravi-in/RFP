"""
Document Analyzer Agent

Analyzes RFP document structure, themes, and requirements.
Supports multi-document analysis and cross-reference detection.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig

logger = logging.getLogger(__name__)


class DocumentAnalyzerAgent:
    """
    Agent that analyzes RFP documents to extract:
    - Document structure and sections
    - Key themes and focus areas
    - Requirements and evaluation criteria
    - Multi-document analysis with cross-references
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

    MULTI_DOC_PROMPT = """Analyze multiple RFP documents and identify relationships between them.

## Documents
{documents}

## Task
1. Identify common themes across documents
2. Find cross-references between documents
3. Detect conflicting requirements
4. Summarize the overall RFP package

## Response Format (JSON only)
{{
  "document_summaries": [
    {{"doc_id": 1, "title": "Document title", "purpose": "Main purpose", "key_sections": ["section1", "section2"]}}
  ],
  "common_themes": ["theme1", "theme2"],
  "cross_references": [
    {{"from_doc": 1, "to_doc": 2, "reference_type": "dependency|clarification|supplement", "description": "What is referenced"}}
  ],
  "conflicts": [
    {{"doc1": 1, "doc2": 2, "conflict_type": "requirement|timeline|scope", "description": "What conflicts"}}
  ],
  "combined_requirements_count": 0,
  "combined_questions_count": 0,
  "overall_complexity": 0.0-1.0,
  "recommended_response_order": [1, 2, 3]
}}

Return ONLY valid JSON."""

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
    
    def analyze_multiple(
        self,
        documents: List[Dict],
        session_state: Dict = None
    ) -> Dict:
        """
        Analyze multiple documents together.
        
        Args:
            documents: List of {id, name, text} dicts
            session_state: Shared state
            
        Returns:
            Combined analysis with cross-references
        """
        session_state = session_state or {}
        
        if not documents:
            return {"success": False, "error": "No documents provided"}
        
        # Analyze each document individually first
        individual_analyses = []
        combined_text = ""
        
        for doc in documents:
            doc_analysis = self._analyze_with_ai(doc.get("text", "")[:15000])
            individual_analyses.append({
                "doc_id": doc.get("id"),
                "name": doc.get("name"),
                "analysis": doc_analysis
            })
            combined_text += f"\n\n--- Document {doc.get('id')}: {doc.get('name')} ---\n"
            combined_text += doc.get("text", "")[:8000]
        
        # Analyze relationships between documents
        try:
            relationship_analysis = self._analyze_multi_doc_relationships(documents:=documents)
        except Exception as e:
            logger.error(f"Multi-doc analysis failed: {e}")
            relationship_analysis = self._fallback_multi_doc_analysis(individual_analyses)
        
        # Merge analyses
        merged = self._merge_analyses(individual_analyses)
        
        # Store in session
        session_state[SessionKeys.DOCUMENT_STRUCTURE] = merged
        session_state["multi_doc_analysis"] = {
            "individual": individual_analyses,
            "relationships": relationship_analysis
        }
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "multi_document_analyzed",
            "summary": f"Analyzed {len(documents)} documents with {len(relationship_analysis.get('cross_references', []))} cross-references"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "documents_count": len(documents),
            "individual_analyses": individual_analyses,
            "merged_analysis": merged,
            "relationships": relationship_analysis,
            "session_state": session_state
        }
    
    def _analyze_multi_doc_relationships(self, documents: List[Dict]) -> Dict:
        """Analyze relationships between multiple documents."""
        client = self.config.client
        if not client:
            return {"cross_references": [], "conflicts": []}
        
        # Format documents for prompt
        docs_text = ""
        for i, doc in enumerate(documents):
            text = doc.get("text", "")[:5000]
            docs_text += f"\n### Document {i+1}: {doc.get('name', f'Document {i+1}')}\n{text}\n"
        
        prompt = self.MULTI_DOC_PROMPT.format(documents=docs_text)
        
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
            logger.error(f"Multi-doc relationship analysis error: {e}")
            return {"cross_references": [], "conflicts": []}
    
    def _merge_analyses(self, analyses: List[Dict]) -> Dict:
        """Merge multiple document analyses into one."""
        merged = {
            "sections": [],
            "themes": set(),
            "requirements": [],
            "evaluation_criteria": [],
            "deliverables": [],
            "timeline": [],
            "questions_identified": [],
            "document_type": "rfp",
            "complexity_score": 0.0
        }
        
        for item in analyses:
            analysis = item.get("analysis", {})
            doc_id = item.get("doc_id")
            
            # Merge sections with source tracking
            for section in analysis.get("sections", []):
                section["source_doc"] = doc_id
                merged["sections"].append(section)
            
            # Merge themes
            for theme in analysis.get("themes", []):
                merged["themes"].add(theme)
            
            # Merge requirements
            for req in analysis.get("requirements", []):
                req["source_doc"] = doc_id
                merged["requirements"].append(req)
            
            # Merge other fields
            merged["evaluation_criteria"].extend(analysis.get("evaluation_criteria", []))
            merged["deliverables"].extend(analysis.get("deliverables", []))
            merged["timeline"].extend(analysis.get("timeline", []))
            merged["questions_identified"].extend(analysis.get("questions_identified", []))
            
            # Average complexity
            merged["complexity_score"] += analysis.get("complexity_score", 0.5)
        
        # Finalize
        merged["themes"] = list(merged["themes"])
        if analyses:
            merged["complexity_score"] /= len(analyses)
        
        return merged
    
    def _fallback_multi_doc_analysis(self, analyses: List[Dict]) -> Dict:
        """Fallback multi-doc analysis without AI."""
        # Find common themes
        all_themes = []
        for item in analyses:
            all_themes.extend(item.get("analysis", {}).get("themes", []))
        
        theme_counts = {}
        for theme in all_themes:
            theme_counts[theme] = theme_counts.get(theme, 0) + 1
        
        common = [t for t, c in theme_counts.items() if c > 1]
        
        return {
            "document_summaries": [
                {"doc_id": a.get("doc_id"), "title": a.get("name"), "purpose": "RFP Document"}
                for a in analyses
            ],
            "common_themes": common,
            "cross_references": [],
            "conflicts": [],
            "overall_complexity": sum(a.get("analysis", {}).get("complexity_score", 0.5) for a in analyses) / len(analyses) if analyses else 0.5,
            "recommended_response_order": [a.get("doc_id") for a in analyses]
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

