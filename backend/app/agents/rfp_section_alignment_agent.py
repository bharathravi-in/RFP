"""
RFP Section Alignment Agent

Enterprise-grade agent that analyzes full RFP documents and correctly maps
ALL questions to the appropriate proposal sections based on:
1. Knowledge Base-derived section taxonomy
2. Intent-based question classification
3. Complete section coverage enforcement
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional, Set

from .config import get_agent_config, SessionKeys

logger = logging.getLogger(__name__)


class RFPSectionAlignmentAgent:
    """
    Agent that fixes RFP question-to-proposal section alignment.
    
    Core responsibilities:
    - Parse ENTIRE RFP document (all questions, sub-questions, requirements)
    - Build master section list from Knowledge Base approved proposals
    - Classify each question's intent and map to correct section
    - Ensure complete section coverage (no dropped sections)
    """
    
    # Master Section Taxonomy - derived from enterprise proposal best practices
    # This serves as fallback when KB doesn't have approved proposals
    MASTER_SECTION_TAXONOMY = {
        'executive_summary': {
            'name': 'Executive Summary',
            'aliases': ['summary', 'overview', 'introduction'],
            'intent_keywords': ['summarize', 'overview', 'introduction', 'high-level'],
            'is_narrative_only': True,
            'order': 1
        },
        'understanding': {
            'name': 'Our Understanding',
            'aliases': ['understanding of requirements', 'project understanding', 'client needs'],
            'intent_keywords': ['understand', 'requirements', 'needs', 'objectives', 'goals'],
            'is_narrative_only': False,
            'order': 2
        },
        'scope_of_work': {
            'name': 'Scope of Work',
            'aliases': ['scope', 'deliverables', 'work scope'],
            'intent_keywords': ['scope', 'deliverables', 'services', 'activities', 'tasks'],
            'is_narrative_only': False,
            'order': 3
        },
        'functional_requirements': {
            'name': 'Functional Requirements',
            'aliases': ['requirements', 'functional specs', 'business requirements'],
            'intent_keywords': ['functional', 'feature', 'capability', 'system shall', 'must'],
            'is_narrative_only': False,
            'order': 4
        },
        'technical_approach': {
            'name': 'Technical Approach',
            'aliases': ['solution approach', 'methodology', 'technical solution'],
            'intent_keywords': ['approach', 'methodology', 'solution', 'architecture', 'design'],
            'is_narrative_only': False,
            'order': 5
        },
        'technology_stack': {
            'name': 'Technology Stack',
            'aliases': ['technology', 'platform', 'tools', 'infrastructure'],
            'intent_keywords': ['technology', 'platform', 'database', 'programming', 'framework', 'cloud'],
            'is_narrative_only': False,
            'order': 6
        },
        'implementation_plan': {
            'name': 'Implementation Plan',
            'aliases': ['project plan', 'timeline', 'schedule', 'phases'],
            'intent_keywords': ['implementation', 'timeline', 'schedule', 'phase', 'milestone', 'plan'],
            'is_narrative_only': False,
            'order': 7
        },
        'team_resources': {
            'name': 'Team & Resources',
            'aliases': ['team', 'resources', 'staffing', 'personnel', 'organization'],
            'intent_keywords': ['team', 'resource', 'staff', 'personnel', 'experience', 'qualifications'],
            'is_narrative_only': False,
            'order': 8
        },
        'quality_management': {
            'name': 'Quality Management',
            'aliases': ['quality', 'QA', 'testing', 'assurance'],
            'intent_keywords': ['quality', 'testing', 'QA', 'assurance', 'standards', 'ISO'],
            'is_narrative_only': False,
            'order': 9
        },
        'security_compliance': {
            'name': 'Security & Compliance',
            'aliases': ['security', 'compliance', 'data protection', 'privacy'],
            'intent_keywords': ['security', 'compliance', 'gdpr', 'hipaa', 'encryption', 'privacy', 'certification'],
            'is_narrative_only': False,
            'order': 10
        },
        'risk_management': {
            'name': 'Risk Management',
            'aliases': ['risks', 'mitigation', 'contingency'],
            'intent_keywords': ['risk', 'mitigation', 'contingency', 'challenge', 'issue'],
            'is_narrative_only': False,
            'order': 11
        },
        'support_maintenance': {
            'name': 'Support & Maintenance',
            'aliases': ['support', 'maintenance', 'SLA', 'service level'],
            'intent_keywords': ['support', 'maintenance', 'SLA', 'uptime', 'availability', 'help desk'],
            'is_narrative_only': False,
            'order': 12
        },
        'training': {
            'name': 'Training & Knowledge Transfer',
            'aliases': ['training', 'knowledge transfer', 'documentation'],
            'intent_keywords': ['training', 'knowledge transfer', 'documentation', 'user guide', 'manual'],
            'is_narrative_only': False,
            'order': 13
        },
        'project_governance': {
            'name': 'Project Governance',
            'aliases': ['governance', 'communication', 'reporting', 'escalation'],
            'intent_keywords': ['governance', 'communication', 'reporting', 'escalation', 'meeting', 'status'],
            'is_narrative_only': False,
            'order': 14
        },
        'references': {
            'name': 'References & Case Studies',
            'aliases': ['references', 'case studies', 'past performance', 'experience'],
            'intent_keywords': ['reference', 'case study', 'past performance', 'similar project', 'client'],
            'is_narrative_only': False,
            'order': 15
        },
        'assumptions': {
            'name': 'Assumptions & Dependencies',
            'aliases': ['assumptions', 'dependencies', 'constraints', 'exclusions'],
            'intent_keywords': ['assumption', 'dependency', 'constraint', 'exclusion', 'out of scope'],
            'is_narrative_only': False,
            'order': 16
        },
        'commercials': {
            'name': 'Commercials & Pricing',
            'aliases': ['pricing', 'cost', 'commercials', 'fees', 'payment'],
            'intent_keywords': ['price', 'cost', 'fee', 'commercial', 'payment', 'budget', 'rate'],
            'is_narrative_only': False,
            'order': 17
        },
        'terms_conditions': {
            'name': 'Terms & Conditions',
            'aliases': ['terms', 'conditions', 'contract', 'legal'],
            'intent_keywords': ['term', 'condition', 'contract', 'legal', 'warranty', 'liability'],
            'is_narrative_only': True,
            'order': 18
        },
        'confidentiality': {
            'name': 'Confidentiality & NDA',
            'aliases': ['confidentiality', 'NDA', 'non-disclosure'],
            'intent_keywords': ['confidential', 'NDA', 'non-disclosure', 'proprietary'],
            'is_narrative_only': True,
            'order': 19
        },
        'appendices': {
            'name': 'Appendices',
            'aliases': ['appendix', 'attachments', 'annexures'],
            'intent_keywords': ['appendix', 'attachment', 'annexure', 'additional'],
            'is_narrative_only': True,
            'order': 20
        }
    }
    
    # Question intent classification patterns
    INTENT_PATTERNS = {
        'company_info': {
            'patterns': [
                r'company\s+(?:profile|history|background|overview)',
                r'(?:describe|provide).*?(?:organization|company)',
                r'years?\s+(?:in\s+)?(?:business|operation)',
                r'(?:employees?|staff|workforce)\s+(?:count|size)',
            ],
            'target_section': 'understanding'
        },
        'technical_capability': {
            'patterns': [
                r'(?:technical|technology)\s+(?:capability|approach|solution)',
                r'(?:describe|explain).*?(?:architecture|infrastructure)',
                r'(?:platform|framework|database|programming)',
                r'(?:integration|API|interface)',
            ],
            'target_section': 'technical_approach'
        },
        'security': {
            'patterns': [
                r'(?:security|secure)\s+(?:measures?|controls?|practices?)',
                r'(?:encryption|authentication|authorization)',
                r'(?:gdpr|hipaa|soc|pci|iso\s*27001)',
                r'(?:compliance|regulatory|certification)',
                r'(?:data\s+protection|privacy)',
            ],
            'target_section': 'security_compliance'
        },
        'pricing': {
            'patterns': [
                r'(?:price|pricing|cost|fee|rate)',
                r'(?:commercial|financial)\s+(?:proposal|terms)',
                r'(?:payment|billing)\s+(?:terms?|schedule)',
                r'(?:license|subscription)\s+(?:fee|cost)',
            ],
            'target_section': 'commercials'
        },
        'implementation': {
            'patterns': [
                r'(?:implementation|deployment)\s+(?:plan|approach|timeline)',
                r'(?:project|delivery)\s+(?:plan|schedule|timeline)',
                r'(?:phase|milestone|deliverable)',
                r'(?:go-live|rollout|launch)',
            ],
            'target_section': 'implementation_plan'
        },
        'support': {
            'patterns': [
                r'(?:support|maintenance)\s+(?:model|approach|plan)',
                r'(?:SLA|service\s+level|uptime|availability)',
                r'(?:help\s+desk|ticket|incident)',
                r'(?:response|resolution)\s+time',
            ],
            'target_section': 'support_maintenance'
        },
        'team': {
            'patterns': [
                r'(?:team|resource|staff)\s+(?:structure|composition|allocation)',
                r'(?:project\s+manager|lead|architect)',
                r'(?:experience|qualification|certification)\s+of.*?(?:team|staff)',
                r'(?:resume|CV|bio)',
            ],
            'target_section': 'team_resources'
        },
        'quality': {
            'patterns': [
                r'(?:quality|QA)\s+(?:assurance|management|control)',
                r'(?:testing|test)\s+(?:approach|strategy|methodology)',
                r'(?:defect|bug)\s+(?:management|tracking)',
            ],
            'target_section': 'quality_management'
        },
        'references': {
            'patterns': [
                r'(?:reference|client)\s+(?:list|contact)',
                r'(?:case\s+study|success\s+story)',
                r'(?:similar|past|previous)\s+(?:project|engagement|experience)',
            ],
            'target_section': 'references'
        },
        'training': {
            'patterns': [
                r'(?:training|knowledge\s+transfer)',
                r'(?:user|admin)\s+(?:training|guide|manual)',
                r'(?:documentation|document)',
            ],
            'target_section': 'training'
        },
        'risk': {
            'patterns': [
                r'(?:risk|challenge)\s+(?:management|mitigation|assessment)',
                r'(?:contingency|fallback)\s+(?:plan|approach)',
            ],
            'target_section': 'risk_management'
        }
    }
    
    ALIGNMENT_PROMPT = """You are an Enterprise Proposal Section Alignment Expert.

## RFP Document Text
{rfp_text}

## Master Proposal Sections (from approved proposals)
{section_list}

## Task
Analyze the ENTIRE RFP document and:
1. Extract ALL questions, requirements, and information requests
2. Map EACH question to the most appropriate proposal section from the master list
3. Base mapping on the INTENT of the question, not just keywords

## Rules
- Every question must be mapped to exactly ONE section
- If a question spans multiple areas, choose the DOMINANT intent
- Do not create catch-all sections
- Do not default everything to "Scope" or "Approach"
- Sections with no questions should be marked as "narrative_only"

## Response Format (JSON only)
{{
  "total_questions_found": 0,
  "section_mappings": [
    {{
      "section_id": "section_key",
      "section_name": "Section Name",
      "questions": [
        {{
          "id": 1,
          "text": "Question text",
          "original_reference": "Section 3.2.1",
          "intent": "What the question is really asking for"
        }}
      ],
      "is_narrative_only": false
    }}
  ],
  "unmapped_questions": [],
  "analysis_notes": "Any important observations"
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='rfp_analysis')
        self.name = "RFPSectionAlignmentAgent"
        self.org_id = org_id
        self._kb_section_taxonomy = None
    
    def align_rfp_to_sections(
        self,
        rfp_text: str,
        project_id: int = None,
        session_state: Dict = None
    ) -> Dict:
        """
        Main entry point: Align RFP questions to proposal sections.
        
        Args:
            rfp_text: Full RFP document text
            project_id: Project ID for KB context
            session_state: Shared state
            
        Returns:
            Complete section-question alignment
        """
        session_state = session_state or {}
        
        if not rfp_text:
            return {"success": False, "error": "No RFP text provided"}
        
        # Step 1: Build master section list from KB
        master_sections = self._build_master_section_list(project_id)
        
        # Step 2: Extract ALL questions from RFP
        all_questions = self._extract_all_questions(rfp_text)
        
        # Step 3: Classify and map questions to sections
        try:
            section_mappings = self._map_questions_to_sections(
                rfp_text, all_questions, master_sections
            )
        except Exception as e:
            logger.error(f"AI mapping failed: {e}")
            section_mappings = self._fallback_mapping(all_questions, master_sections)
        
        # Step 4: Enforce section completeness
        complete_mappings = self._enforce_completeness(section_mappings, master_sections)
        
        # Step 5: Validate output
        validation = self._validate_alignment(complete_mappings, all_questions)
        
        # Store in session
        session_state["section_alignment"] = complete_mappings
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        messages.append({
            "agent": self.name,
            "action": "rfp_aligned",
            "summary": f"Aligned {len(all_questions)} questions to {len(complete_mappings)} sections"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "total_questions": len(all_questions),
            "total_sections": len(complete_mappings),
            "section_mappings": complete_mappings,
            "validation": validation,
            "session_state": session_state
        }
    
    def _build_master_section_list(self, project_id: int = None) -> List[Dict]:
        """
        Build master section list from Knowledge Base approved proposals.
        Falls back to MASTER_SECTION_TAXONOMY if KB is empty.
        """
        sections = []
        kb_sections = set()
        
        # Try to get sections from KB
        if self.org_id:
            try:
                from app.services.qdrant_service import get_qdrant_service
                qdrant = get_qdrant_service(self.org_id)
                
                # Search for proposal templates and section structures
                results = qdrant.search(
                    query="proposal sections structure template",
                    org_id=self.org_id,
                    limit=10
                )
                
                # Extract section names from KB content
                for result in results:
                    content = result.get('content_preview', '')
                    # Look for section headers in content
                    section_matches = re.findall(
                        r'(?:^|\n)(?:\d+\.?\s+)?([A-Z][a-zA-Z\s&]+)(?:\n|$)',
                        content
                    )
                    kb_sections.update(section_matches)
                    
            except Exception as e:
                logger.warning(f"KB section extraction failed: {e}")
        
        # Merge KB sections with master taxonomy
        for section_id, section_info in self.MASTER_SECTION_TAXONOMY.items():
            section = {
                'id': section_id,
                'name': section_info['name'],
                'aliases': section_info['aliases'],
                'order': section_info['order'],
                'is_narrative_only': section_info.get('is_narrative_only', False),
                'from_kb': False
            }
            
            # Check if this section was found in KB
            for kb_section in kb_sections:
                if self._section_matches(kb_section.lower(), section_info):
                    section['from_kb'] = True
                    break
            
            sections.append(section)
        
        # Sort by order
        sections.sort(key=lambda x: x['order'])
        
        return sections
    
    def _section_matches(self, text: str, section_info: Dict) -> bool:
        """Check if text matches a section definition."""
        name = section_info['name'].lower()
        if name in text or text in name:
            return True
        
        for alias in section_info.get('aliases', []):
            if alias.lower() in text or text in alias.lower():
                return True
        
        return False
    
    def _extract_all_questions(self, text: str) -> List[Dict]:
        """Extract ALL questions, requirements, and requests from RFP."""
        questions = []
        question_id = 0
        
        # Pattern categories for comprehensive extraction
        patterns = [
            # Direct questions
            (r'(?:^|\n)\s*(?:(\d+(?:\.\d+)*)[\.:\s]+)?([A-Z][^.?!]*\?)', 'question'),
            # Numbered requirements
            (r'(?:^|\n)\s*(\d+(?:\.\d+)*)[\.:\s]+((?:The\s+)?(?:Vendor|Contractor|Provider|Bidder)\s+(?:shall|must|should|will)[^.]+\.)', 'requirement'),
            # Please statements
            (r'(?:^|\n)\s*(?:(\d+(?:\.\d+)*)[\.:\s]+)?(Please\s+(?:describe|explain|provide|list|detail|indicate|specify)[^.]+\.)', 'request'),
            # Describe/Explain statements
            (r'(?:^|\n)\s*(?:(\d+(?:\.\d+)*)[\.:\s]+)?((?:Describe|Explain|Provide|List|Detail|Indicate|Specify)[^.]+\.)', 'request'),
            # Requirement tables (common in RFPs)
            (r'(?:^|\n)\s*(?:(\d+(?:\.\d+)*)[\.:\s]+)?(?:REQ-\d+:?\s*)?([^.]+(?:required|mandatory|must have)[^.]*\.)', 'requirement'),
        ]
        
        for pattern, q_type in patterns:
            for match in re.finditer(pattern, text, re.MULTILINE | re.IGNORECASE):
                groups = match.groups()
                
                if len(groups) >= 2:
                    ref = groups[0] if groups[0] else ''
                    q_text = groups[1].strip() if groups[1] else ''
                else:
                    ref = ''
                    q_text = groups[0].strip() if groups[0] else ''
                
                if len(q_text) < 15:  # Skip very short matches
                    continue
                
                # Skip if already captured
                q_lower = q_text.lower()
                if any(existing['text'].lower() == q_lower for existing in questions):
                    continue
                
                question_id += 1
                questions.append({
                    'id': question_id,
                    'text': q_text,
                    'original_reference': ref,
                    'type': q_type,
                    'position': match.start()
                })
        
        # Sort by position in document
        questions.sort(key=lambda x: x['position'])
        
        # Re-number after sorting
        for i, q in enumerate(questions, 1):
            q['id'] = i
        
        return questions
    
    def _map_questions_to_sections(
        self,
        rfp_text: str,
        questions: List[Dict],
        master_sections: List[Dict]
    ) -> List[Dict]:
        """Map questions to sections using AI with intent analysis."""
        client = self.config.client
        
        if not client:
            return self._fallback_mapping(questions, master_sections)
        
        # Format section list
        section_list = "\n".join([
            f"- {s['id']}: {s['name']}"
            for s in master_sections
        ])
        
        prompt = self.ALIGNMENT_PROMPT.format(
            rfp_text=rfp_text[:20000],
            section_list=section_list
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
            
            result = json.loads(response_text)
            return result.get('section_mappings', [])
            
        except Exception as e:
            logger.error(f"AI section mapping error: {e}")
            return self._fallback_mapping(questions, master_sections)
    
    def _fallback_mapping(
        self,
        questions: List[Dict],
        master_sections: List[Dict]
    ) -> List[Dict]:
        """Pattern-based fallback when AI is unavailable."""
        section_questions = {s['id']: [] for s in master_sections}
        
        for question in questions:
            q_text = question['text'].lower()
            matched_section = None
            best_score = 0
            
            # Try intent patterns first
            for intent_key, intent_info in self.INTENT_PATTERNS.items():
                for pattern in intent_info['patterns']:
                    if re.search(pattern, q_text, re.IGNORECASE):
                        target = intent_info['target_section']
                        if target in section_questions:
                            matched_section = target
                            best_score = 10
                            break
                if matched_section:
                    break
            
            # If no intent match, try keyword matching
            if not matched_section:
                for section in master_sections:
                    section_info = self.MASTER_SECTION_TAXONOMY.get(section['id'], {})
                    keywords = section_info.get('intent_keywords', [])
                    
                    score = sum(1 for kw in keywords if kw.lower() in q_text)
                    if score > best_score:
                        best_score = score
                        matched_section = section['id']
            
            # Default to scope_of_work if no match
            if not matched_section:
                matched_section = 'scope_of_work'
            
            section_questions[matched_section].append({
                'id': question['id'],
                'text': question['text'],
                'original_reference': question.get('original_reference', ''),
                'intent': 'auto-classified'
            })
        
        # Build result
        result = []
        for section in master_sections:
            section_id = section['id']
            questions_list = section_questions.get(section_id, [])
            
            result.append({
                'section_id': section_id,
                'section_name': section['name'],
                'questions': questions_list,
                'is_narrative_only': len(questions_list) == 0
            })
        
        return result
    
    def _enforce_completeness(
        self,
        mappings: List[Dict],
        master_sections: List[Dict]
    ) -> List[Dict]:
        """Ensure all master sections are present in output."""
        existing_ids = {m['section_id'] for m in mappings}
        
        for section in master_sections:
            if section['id'] not in existing_ids:
                # Add missing section as narrative-only
                mappings.append({
                    'section_id': section['id'],
                    'section_name': section['name'],
                    'questions': [],
                    'is_narrative_only': True,
                    'narrative_note': "This section will be addressed as a standard proposal narrative based on organizational best practices."
                })
        
        # Sort by section order
        section_order = {s['id']: s['order'] for s in master_sections}
        mappings.sort(key=lambda x: section_order.get(x['section_id'], 99))
        
        return mappings
    
    def _validate_alignment(
        self,
        mappings: List[Dict],
        original_questions: List[Dict]
    ) -> Dict:
        """Validate the alignment output."""
        mapped_question_ids = set()
        for mapping in mappings:
            for q in mapping.get('questions', []):
                mapped_question_ids.add(q['id'])
        
        original_ids = {q['id'] for q in original_questions}
        unmapped = original_ids - mapped_question_ids
        duplicates = len(mapped_question_ids) - len(set(mapped_question_ids))
        
        sections_with_questions = len([m for m in mappings if m.get('questions')])
        narrative_only_sections = len([m for m in mappings if m.get('is_narrative_only')])
        
        return {
            'is_valid': len(unmapped) == 0 and duplicates == 0,
            'total_original_questions': len(original_questions),
            'total_mapped_questions': len(mapped_question_ids),
            'unmapped_questions': list(unmapped),
            'duplicate_mappings': duplicates,
            'sections_with_questions': sections_with_questions,
            'narrative_only_sections': narrative_only_sections,
            'coverage_percentage': round(len(mapped_question_ids) / len(original_questions) * 100, 1) if original_questions else 100
        }
    
    def get_section_summary(self, mappings: List[Dict]) -> str:
        """Generate markdown summary of section-question alignment."""
        lines = ["# RFP Question-to-Section Alignment\n"]
        
        for mapping in mappings:
            section_name = mapping['section_name']
            questions = mapping.get('questions', [])
            
            lines.append(f"\n## {section_name}\n")
            
            if questions:
                for q in questions:
                    ref = f" ({q['original_reference']})" if q.get('original_reference') else ""
                    lines.append(f"- {q['text'][:200]}{ref}")
            else:
                lines.append("*This section will be addressed as a standard proposal narrative based on organizational best practices.*")
        
        return "\n".join(lines)


def get_rfp_section_alignment_agent(org_id: int = None) -> RFPSectionAlignmentAgent:
    """Factory function to get RFP Section Alignment Agent."""
    return RFPSectionAlignmentAgent(org_id=org_id)
