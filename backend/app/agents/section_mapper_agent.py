"""
Section Mapper Agent

Intelligently maps RFP questions to proposal sections.
Uses organization's section templates and learns from past mappings.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig

logger = logging.getLogger(__name__)


class SectionMapperAgent:
    """
    Agent that maps questions to proposal sections.
    - Uses default proposal structure
    - Learns organization's naming conventions
    - Handles custom section templates
    - Suggests section organization
    - Tracks section completeness percentage
    - Intelligent question grouping by theme
    """
    
    # Section completeness tracking configuration
    SECTION_COMPLETENESS_TARGETS = {
        'executive_summary': {'min_questions': 0, 'min_content_words': 200, 'required': True},
        'company_background': {'min_questions': 2, 'min_content_words': 150, 'required': True},
        'technical_approach': {'min_questions': 3, 'min_content_words': 300, 'required': True},
        'security_compliance': {'min_questions': 3, 'min_content_words': 250, 'required': True},
        'implementation': {'min_questions': 2, 'min_content_words': 200, 'required': True},
        'support_maintenance': {'min_questions': 2, 'min_content_words': 150, 'required': False},
        'pricing': {'min_questions': 1, 'min_content_words': 100, 'required': True},
        'references': {'min_questions': 1, 'min_content_words': 100, 'required': False},
        'appendix': {'min_questions': 0, 'min_content_words': 0, 'required': False}
    }
    
    # Intelligent grouping - related question themes
    QUESTION_GROUPING = {
        'security_auth': ['authentication', 'authorization', 'sso', 'mfa', 'identity'],
        'security_data': ['encryption', 'data protection', 'privacy', 'gdpr', 'pii'],
        'security_audit': ['audit', 'logging', 'monitoring', 'soc', 'penetration'],
        'technical_arch': ['architecture', 'infrastructure', 'scalability', 'cloud'],
        'technical_int': ['integration', 'api', 'migration', 'data transfer'],
        'support_sla': ['sla', 'uptime', 'availability', 'response time'],
        'support_process': ['support process', 'escalation', 'ticketing', 'help desk'],
        'commercial_pricing': ['pricing', 'cost', 'license', 'subscription'],
        'commercial_terms': ['payment', 'contract', 'terms', 'renewal']
    }

    
    # Default proposal structure
    DEFAULT_SECTIONS = {
        "executive_summary": {
            "name": "Executive Summary",
            "description": "High-level overview and value proposition",
            "keywords": ["overview", "summary", "introduction", "about us", "company"],
            "order": 1
        },
        "company_background": {
            "name": "Company Background",
            "description": "Company history, experience, and qualifications",
            "keywords": ["history", "experience", "background", "qualifications", "years in business"],
            "order": 2
        },
        "technical_approach": {
            "name": "Technical Approach",
            "description": "Technical solution, architecture, and methodology",
            "keywords": ["technical", "architecture", "solution", "methodology", "implementation", "technology"],
            "order": 3
        },
        "security_compliance": {
            "name": "Security & Compliance",
            "description": "Security measures, certifications, and regulatory compliance",
            "keywords": ["security", "compliance", "gdpr", "hipaa", "soc", "encryption", "certification"],
            "order": 4
        },
        "implementation": {
            "name": "Implementation Plan",
            "description": "Project timeline, milestones, and deployment",
            "keywords": ["implementation", "timeline", "deployment", "migration", "training", "onboarding"],
            "order": 5
        },
        "support_maintenance": {
            "name": "Support & Maintenance",
            "description": "Ongoing support, SLAs, and maintenance",
            "keywords": ["support", "maintenance", "sla", "uptime", "help desk", "24/7", "response time"],
            "order": 6
        },
        "pricing": {
            "name": "Pricing & Commercial",
            "description": "Pricing, licensing, and commercial terms",
            "keywords": ["pricing", "cost", "price", "fee", "license", "subscription", "payment"],
            "order": 7
        },
        "references": {
            "name": "References & Case Studies",
            "description": "Customer references and success stories",
            "keywords": ["reference", "case study", "customer", "client", "success", "testimonial"],
            "order": 8
        },
        "appendix": {
            "name": "Appendix",
            "description": "Additional documentation and certifications",
            "keywords": ["appendix", "attachment", "certificate", "documentation", "additional"],
            "order": 9
        }
    }
    
    MAPPING_PROMPT = """Map each RFP question to the most appropriate proposal section.

## Available Sections
{sections}

## Questions to Map
{questions}

## Mapping Rules
1. Consider the primary topic of each question
2. Security/compliance questions go to Security & Compliance
3. Pricing-related questions go to Pricing & Commercial
4. Technical/architecture questions go to Technical Approach
5. Company background/experience questions go to Company Background
6. If unclear, suggest the best fit with lower confidence

## Response Format (JSON only)
{{
  "mappings": [
    {{
      "question_id": 1,
      "section_id": "section_key",
      "section_name": "Section Name",
      "confidence": 0.0-1.0,
      "reasoning": "Why this section"
    }}
  ],
  "section_distribution": {{
    "section_key": 5,
    "another_section": 3
  }},
  "suggested_order": ["section1", "section2"]
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='default')
        self.name = "SectionMapperAgent"
        self.org_id = org_id
        self._custom_sections = None
    
    @property
    def sections(self) -> Dict:
        """Get sections (custom or default)."""
        if self._custom_sections:
            return self._custom_sections
        
        # Try to load custom sections from organization
        custom = self._load_org_sections()
        if custom:
            self._custom_sections = custom
            return custom
        
        return self.DEFAULT_SECTIONS
    
    def map_questions(
        self,
        questions: List[Dict] = None,
        session_state: Dict = None,
        custom_sections: Dict = None
    ) -> Dict:
        """
        Map questions to proposal sections.
        
        Args:
            questions: List of questions to map
            session_state: Shared state
            custom_sections: Optional custom section structure
            
        Returns:
            Mapping results with section assignments
        """
        session_state = session_state or {}
        
        # Get questions from session if not provided
        questions = questions or session_state.get(SessionKeys.EXTRACTED_QUESTIONS, [])
        if not questions:
            return {"success": False, "error": "No questions to map"}
        
        # Use custom sections if provided
        if custom_sections:
            self._custom_sections = custom_sections
        
        try:
            mappings = self._map_with_ai(questions)
        except Exception as e:
            logger.error(f"AI mapping failed: {e}")
            mappings = self._fallback_mapping(questions)
        
        # Store in session state
        session_state["section_mappings"] = mappings
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        sections_used = len(set(m.get("section_id") for m in mappings.get("mappings", [])))
        messages.append({
            "agent": self.name,
            "action": "questions_mapped",
            "summary": f"Mapped {len(questions)} questions to {sections_used} sections"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "mappings": mappings.get("mappings", []),
            "section_distribution": mappings.get("section_distribution", {}),
            "suggested_order": mappings.get("suggested_order", []),
            "sections_used": sections_used,
            "session_state": session_state
        }
    
    def get_section_for_question(
        self,
        question: Dict,
        mappings: List[Dict] = None
    ) -> Optional[Dict]:
        """
        Get the section assignment for a specific question.
        
        Args:
            question: Question dict with 'id'
            mappings: Optional pre-computed mappings
            
        Returns:
            Section info or None
        """
        q_id = question.get("id")
        
        if mappings:
            for m in mappings:
                if m.get("question_id") == q_id:
                    return {
                        "section_id": m.get("section_id"),
                        "section_name": m.get("section_name"),
                        "confidence": m.get("confidence", 0.5)
                    }
        
        # Fallback to keyword-based mapping
        return self._map_single_question(question)
    
    def get_questions_by_section(
        self,
        questions: List[Dict],
        mappings: List[Dict]
    ) -> Dict[str, List[Dict]]:
        """
        Group questions by their mapped sections.
        
        Args:
            questions: List of questions
            mappings: Section mappings
            
        Returns:
            Dict of section_id -> list of questions
        """
        by_section = {}
        
        # Create lookup
        mapping_lookup = {m.get("question_id"): m for m in mappings}
        
        for q in questions:
            q_id = q.get("id")
            mapping = mapping_lookup.get(q_id, {})
            section_id = mapping.get("section_id", "general")
            
            if section_id not in by_section:
                by_section[section_id] = []
            
            by_section[section_id].append({
                **q,
                "section_confidence": mapping.get("confidence", 0.5)
            })
        
        return by_section
    
    def get_available_sections(self) -> List[Dict]:
        """Get list of available sections with metadata."""
        sections_list = []
        
        for section_id, section_data in self.sections.items():
            sections_list.append({
                "id": section_id,
                "name": section_data.get("name"),
                "description": section_data.get("description"),
                "order": section_data.get("order", 99)
            })
        
        return sorted(sections_list, key=lambda x: x.get("order", 99))
    
    @with_retry(
        config=RetryConfig(max_attempts=2, initial_delay=0.5),
        fallback_models=['gemini-1.5-pro']
    )
    def _map_with_ai(self, questions: List[Dict]) -> Dict:
        """Use AI to map questions to sections."""
        client = self.config.client
        if not client:
            return self._fallback_mapping(questions)
        
        # Format sections
        sections_text = "\n".join([
            f"- {s_id}: {s_data.get('name')} - {s_data.get('description')}"
            for s_id, s_data in self.sections.items()
        ])
        
        # Format questions
        questions_text = "\n".join([
            f"{q.get('id')}. [{q.get('category', 'general')}] {q.get('text', '')[:150]}"
            for q in questions[:50]  # Limit to 50 questions
        ])
        
        prompt = self.MAPPING_PROMPT.format(
            sections=sections_text,
            questions=questions_text
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
            
            return json.loads(response_text)
            
        except Exception as e:
            logger.error(f"AI mapping error: {e}")
            return self._fallback_mapping(questions)
    
    def _fallback_mapping(self, questions: List[Dict]) -> Dict:
        """Keyword-based fallback mapping."""
        mappings = []
        section_counts = {}
        
        for q in questions:
            mapping = self._map_single_question(q)
            mappings.append({
                "question_id": q.get("id"),
                **mapping
            })
            
            section_id = mapping.get("section_id")
            section_counts[section_id] = section_counts.get(section_id, 0) + 1
        
        return {
            "mappings": mappings,
            "section_distribution": section_counts,
            "suggested_order": list(self.sections.keys())
        }
    
    def _map_single_question(self, question: Dict) -> Dict:
        """Map a single question using keywords."""
        text = f"{question.get('text', '')} {question.get('category', '')}".lower()
        
        best_match = None
        best_score = 0
        
        for section_id, section_data in self.sections.items():
            keywords = section_data.get("keywords", [])
            score = sum(1 for kw in keywords if kw in text)
            
            # Boost by category match
            category = question.get("category", "").lower()
            if category in section_id or section_id in category:
                score += 2
            
            if score > best_score:
                best_score = score
                best_match = section_id
        
        # Default to appendix if no match
        if not best_match or best_score == 0:
            best_match = "appendix"
            best_score = 0
        
        return {
            "section_id": best_match,
            "section_name": self.sections.get(best_match, {}).get("name", "Appendix"),
            "confidence": min(0.9, 0.3 + best_score * 0.15),
            "reasoning": "Keyword-based mapping"
        }
    
    def _load_org_sections(self) -> Optional[Dict]:
        """Load custom section structure from organization."""
        if not self.org_id:
            return None
        
        try:
            from app.models import Organization
            org = Organization.query.get(self.org_id)
            if org and org.settings:
                return org.settings.get("proposal_sections")
        except Exception as e:
            logger.warning(f"Could not load org sections: {e}")
        
        return None


def get_section_mapper_agent(org_id: int = None) -> SectionMapperAgent:
    """Factory function to get Section Mapper Agent."""
    return SectionMapperAgent(org_id=org_id)
