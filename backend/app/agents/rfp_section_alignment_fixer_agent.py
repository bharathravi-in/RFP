"""
RFP Section Alignment Fixer Agent

Enterprise Proposal Editor & Structure Correction Agent that ensures every RFP 
question is correctly mapped to the appropriate proposal section based on 
Knowledge Base proposals.

Implements STRICT MODE as per user's system prompt.
"""
import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class RFPSectionAlignmentFixerAgent:
    """
    Agent to fix RFP question-to-section alignment issues.
    
    Core responsibilities:
    1. Parse ENTIRE RFP document
    2. Build master section list from Knowledge Base
    3. Map every question to the correct section
    4. Ensure section completeness
    """
    
    # Master section taxonomy - derived from enterprise proposals
    MASTER_SECTION_TAXONOMY = [
        {
            'id': 'introduction',
            'name': 'Introduction',
            'aliases': ['intro', 'overview', 'opening'],
            'intent_keywords': ['introduce', 'welcome', 'greet', 'submit'],
            'is_narrative_only': True,
            'order': 1
        },
        {
            'id': 'our_understanding',
            'name': 'Our Understanding',
            'aliases': ['understanding', 'requirement understanding', 'needs analysis'],
            'intent_keywords': ['understand', 'requirement', 'need', 'objective', 'goal', 'challenge'],
            'is_narrative_only': True,
            'order': 2
        },
        {
            'id': 'scope_of_work',
            'name': 'Scope of Work',
            'aliases': ['scope', 'work scope', 'deliverables'],
            'intent_keywords': ['scope', 'deliverable', 'in-scope', 'out-of-scope', 'boundary'],
            'is_narrative_only': False,
            'order': 3
        },
        {
            'id': 'functional_requirements',
            'name': 'Functional Requirements',
            'aliases': ['requirements', 'features', 'functionality'],
            'intent_keywords': ['function', 'feature', 'capability', 'workflow', 'module', 'screen'],
            'is_narrative_only': False,
            'order': 4
        },
        {
            'id': 'technical_approach',
            'name': 'Technical Approach',
            'aliases': ['solution', 'approach', 'methodology'],
            'intent_keywords': ['approach', 'solution', 'method', 'technique', 'strategy'],
            'is_narrative_only': False,
            'order': 5
        },
        {
            'id': 'technology_stack',
            'name': 'Technology Stack',
            'aliases': ['tech stack', 'tools', 'technologies'],
            'intent_keywords': ['technology', 'tool', 'platform', 'framework', 'software', 'hardware', 
                               'database', 'cloud', 'api', 'integration'],
            'is_narrative_only': False,
            'order': 6
        },
        {
            'id': 'implementation_plan',
            'name': 'Implementation Plan',
            'aliases': ['project plan', 'timeline', 'schedule'],
            'intent_keywords': ['implement', 'timeline', 'schedule', 'phase', 'milestone', 
                               'go-live', 'deploy', 'rollout'],
            'is_narrative_only': False,
            'order': 7
        },
        {
            'id': 'team_qualifications',
            'name': 'Team & Qualifications',
            'aliases': ['team', 'resources', 'personnel', 'staffing'],
            'intent_keywords': ['team', 'resource', 'staff', 'personnel', 'experience', 
                               'qualification', 'resume', 'cv', 'expertise'],
            'is_narrative_only': False,
            'order': 8
        },
        {
            'id': 'quality_management',
            'name': 'Quality Management',
            'aliases': ['qa', 'quality assurance', 'testing'],
            'intent_keywords': ['quality', 'qa', 'test', 'assurance', 'defect', 'bug', 
                               'acceptance', 'uat'],
            'is_narrative_only': False,
            'order': 9
        },
        {
            'id': 'security_compliance',
            'name': 'Security & Compliance',
            'aliases': ['security', 'compliance', 'data protection'],
            'intent_keywords': ['security', 'secure', 'encrypt', 'gdpr', 'hipaa', 'soc', 
                               'compliance', 'audit', 'access control', 'authentication',
                               'password', 'data protection', 'privacy', 'vulnerability'],
            'is_narrative_only': False,
            'order': 10
        },
        {
            'id': 'risk_management',
            'name': 'Risk Management',
            'aliases': ['risks', 'risk mitigation'],
            'intent_keywords': ['risk', 'mitigate', 'contingency', 'disaster', 'recovery', 
                               'backup', 'failover'],
            'is_narrative_only': False,
            'order': 11
        },
        {
            'id': 'support_maintenance',
            'name': 'Support & Maintenance',
            'aliases': ['support', 'sla', 'maintenance'],
            'intent_keywords': ['support', 'maintain', 'sla', 'service level', 'helpdesk', 
                               'incident', 'availability', 'uptime'],
            'is_narrative_only': False,
            'order': 12
        },
        {
            'id': 'training_documentation',
            'name': 'Training & Documentation',
            'aliases': ['training', 'documentation', 'knowledge transfer'],
            'intent_keywords': ['train', 'document', 'manual', 'guide', 'knowledge transfer',
                               'user guide', 'admin guide'],
            'is_narrative_only': False,
            'order': 13
        },
        {
            'id': 'references',
            'name': 'References & Experience',
            'aliases': ['references', 'case studies', 'past projects'],
            'intent_keywords': ['reference', 'case study', 'past', 'previous', 'similar',
                               'experience', 'client', 'project'],
            'is_narrative_only': False,
            'order': 14
        },
        {
            'id': 'company_profile',
            'name': 'Company Profile',
            'aliases': ['about us', 'company info', 'vendor profile'],
            'intent_keywords': ['company', 'organization', 'about', 'founded', 'history',
                               'employee', 'office', 'location'],
            'is_narrative_only': True,
            'order': 15
        },
        {
            'id': 'pricing_commercial',
            'name': 'Pricing & Commercial',
            'aliases': ['pricing', 'commercials', 'cost', 'fees'],
            'intent_keywords': ['price', 'cost', 'fee', 'commercial', 'payment', 'budget',
                               'license', 'subscription', 'rate'],
            'is_narrative_only': False,
            'order': 16
        },
        {
            'id': 'assumptions_dependencies',
            'name': 'Assumptions & Dependencies',
            'aliases': ['assumptions', 'dependencies', 'constraints'],
            'intent_keywords': ['assume', 'assumption', 'depend', 'constraint', 'prerequisite',
                               'exclude', 'limitation'],
            'is_narrative_only': True,
            'order': 17
        },
        {
            'id': 'confidentiality',
            'name': 'Confidentiality',
            'aliases': ['nda', 'non-disclosure'],
            'intent_keywords': ['confidential', 'nda', 'non-disclosure', 'proprietary'],
            'is_narrative_only': True,
            'order': 18
        },
        {
            'id': 'qa_questionnaire',
            'name': 'Q&A / Questionnaire',
            'aliases': ['q&a', 'questions', 'questionnaire'],
            'intent_keywords': [],  # Catch-all for unmapped questions
            'is_narrative_only': False,
            'order': 99
        },
    ]
    
    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self._llm_provider = None
        logger.info(f"RFPSectionAlignmentFixerAgent initialized for org: {org_id}")
    
    def _get_llm_provider(self):
        """Get LLM provider for AI-assisted classification."""
        if self._llm_provider is None and self.org_id:
            try:
                from app.services.llm_service_helper import get_llm_provider
                self._llm_provider = get_llm_provider(self.org_id, 'analysis')
            except Exception as e:
                logger.warning(f"Could not load LLM provider: {e}")
        return self._llm_provider
    
    def analyze_and_fix_alignment(
        self,
        rfp_text: str,
        extracted_questions: List[Dict],
        kb_context: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Main method to analyze RFP and fix question-to-section alignment.
        
        Args:
            rfp_text: Full RFP document text
            extracted_questions: Questions already extracted from the RFP
            kb_context: Optional Knowledge Base context for section taxonomy
            
        Returns:
            Dict with section_mappings, alignment_summary, and fixes applied
        """
        logger.info(f"Starting alignment fix for {len(extracted_questions)} questions")
        
        # STEP 1: Build master section list (from KB if available)
        master_sections = self._build_master_section_list(kb_context)
        
        # STEP 2: Classify each question's intent
        question_classifications = []
        for q in extracted_questions:
            classification = self._classify_question_intent(q, master_sections)
            question_classifications.append(classification)
        
        # STEP 3: Map questions to sections
        section_mappings = self._map_questions_to_sections(
            extracted_questions, 
            question_classifications,
            master_sections
        )
        
        # STEP 4: Enforce section completeness
        complete_mappings = self._enforce_section_completeness(section_mappings, master_sections)
        
        # STEP 5: Build summary
        summary = self._build_alignment_summary(complete_mappings, extracted_questions)
        
        return {
            'section_mappings': complete_mappings,
            'alignment_summary': summary,
            'master_sections': master_sections,
            'questions_processed': len(extracted_questions),
        }
    
    def _build_master_section_list(self, kb_context: Optional[List[Dict]] = None) -> List[Dict]:
        """
        Build the master section list from KB context or use default taxonomy.
        """
        # Start with default taxonomy
        sections = [s.copy() for s in self.MASTER_SECTION_TAXONOMY]
        
        # If KB context is available, try to extract section patterns
        if kb_context:
            kb_sections = self._extract_sections_from_kb(kb_context)
            # Merge KB sections with default taxonomy
            for kb_sec in kb_sections:
                existing = next((s for s in sections if s['id'] == kb_sec['id']), None)
                if not existing:
                    sections.append(kb_sec)
        
        # Sort by order
        sections.sort(key=lambda x: x.get('order', 99))
        
        logger.info(f"Built master section list with {len(sections)} sections")
        return sections
    
    def _extract_sections_from_kb(self, kb_context: List[Dict]) -> List[Dict]:
        """Extract section patterns from Knowledge Base documents."""
        extracted = []
        
        # Look for section headers in KB content
        section_pattern = r'(?:^|\n)\s*\d+[\.\)]\s*([A-Z][^:\n]{3,50})'
        
        for item in kb_context:
            content = item.get('content', '')
            matches = re.findall(section_pattern, content, re.MULTILINE)
            for match in matches:
                section_name = match.strip()
                section_id = section_name.lower().replace(' ', '_').replace('&', 'and')
                section_id = re.sub(r'[^a-z0-9_]', '', section_id)
                
                if len(section_id) > 3 and section_id not in [s['id'] for s in extracted]:
                    extracted.append({
                        'id': section_id,
                        'name': section_name,
                        'aliases': [],
                        'intent_keywords': section_name.lower().split(),
                        'is_narrative_only': False,
                        'order': 50,  # Middle priority
                        'source': 'knowledge_base'
                    })
        
        return extracted[:10]  # Limit to 10 additional sections
    
    def _classify_question_intent(
        self, 
        question: Dict, 
        master_sections: List[Dict]
    ) -> Dict:
        """
        Classify a question's intent to determine the best section.
        """
        q_text = question.get('text', '').lower()
        
        # Score each section based on keyword matches
        section_scores = []
        
        for section in master_sections:
            score = 0
            
            # Check aliases
            for alias in section.get('aliases', []):
                if alias.lower() in q_text:
                    score += 3
            
            # Check intent keywords
            for keyword in section.get('intent_keywords', []):
                if keyword.lower() in q_text:
                    score += 2
            
            # Check section name
            if section['name'].lower() in q_text:
                score += 4
            
            section_scores.append({
                'section_id': section['id'],
                'section_name': section['name'],
                'score': score
            })
        
        # Sort by score descending
        section_scores.sort(key=lambda x: x['score'], reverse=True)
        
        # Get best match (or default to Q&A if no match)
        best_match = section_scores[0] if section_scores[0]['score'] > 0 else {
            'section_id': 'qa_questionnaire',
            'section_name': 'Q&A / Questionnaire',
            'score': 0
        }
        
        return {
            'question_id': question.get('id'),
            'question_text': question.get('text', '')[:100],
            'primary_section_id': best_match['section_id'],
            'primary_section_name': best_match['section_name'],
            'confidence': min(best_match['score'] / 10.0, 1.0),
            'all_scores': section_scores[:3]  # Top 3 candidates
        }
    
    def _map_questions_to_sections(
        self,
        questions: List[Dict],
        classifications: List[Dict],
        master_sections: List[Dict]
    ) -> List[Dict]:
        """
        Create the final mapping of questions to sections.
        """
        # Initialize section mappings
        section_map = {}
        for section in master_sections:
            section_map[section['id']] = {
                'section_id': section['id'],
                'section_name': section['name'],
                'order': section.get('order', 99),
                'is_narrative_only': section.get('is_narrative_only', False),
                'questions': [],
                'question_count': 0,
            }
        
        # Assign each question to its classified section
        for q, classification in zip(questions, classifications):
            section_id = classification['primary_section_id']
            
            if section_id in section_map:
                section_map[section_id]['questions'].append({
                    'id': q.get('id'),
                    'text': q.get('text', ''),
                    'original_section': q.get('section', ''),
                    'confidence': classification['confidence'],
                })
                section_map[section_id]['question_count'] += 1
        
        # Convert to list and sort by order
        mappings = list(section_map.values())
        mappings.sort(key=lambda x: x['order'])
        
        return mappings
    
    def _enforce_section_completeness(
        self,
        section_mappings: List[Dict],
        master_sections: List[Dict]
    ) -> List[Dict]:
        """
        Ensure every section from master list is present.
        Mark sections with zero questions as narrative-only.
        """
        # Update is_narrative_only based on question count
        for mapping in section_mappings:
            if mapping['question_count'] == 0:
                mapping['is_narrative_only'] = True
                mapping['narrative_note'] = (
                    "This section will be addressed as a standard proposal narrative "
                    "based on organizational best practices."
                )
        
        # Filter out Q&A section if it has no questions
        final_mappings = []
        for mapping in section_mappings:
            if mapping['section_id'] == 'qa_questionnaire' and mapping['question_count'] == 0:
                continue  # Skip empty Q&A section
            final_mappings.append(mapping)
        
        return final_mappings
    
    def _build_alignment_summary(
        self,
        mappings: List[Dict],
        questions: List[Dict]
    ) -> Dict:
        """Build summary statistics for the alignment."""
        total_questions = len(questions)
        mapped_questions = sum(m['question_count'] for m in mappings)
        sections_with_questions = len([m for m in mappings if m['question_count'] > 0])
        narrative_only_sections = len([m for m in mappings if m.get('is_narrative_only')])
        
        # Calculate distribution
        distribution = {}
        for m in mappings:
            if m['question_count'] > 0:
                distribution[m['section_name']] = m['question_count']
        
        return {
            'total_questions': total_questions,
            'mapped_questions': mapped_questions,
            'total_sections': len(mappings),
            'sections_with_questions': sections_with_questions,
            'narrative_only_sections': narrative_only_sections,
            'coverage_percentage': (mapped_questions / max(total_questions, 1)) * 100,
            'question_distribution': distribution,
        }


def get_rfp_alignment_fixer(org_id: int = None) -> RFPSectionAlignmentFixerAgent:
    """Factory function to get RFP Section Alignment Fixer Agent."""
    return RFPSectionAlignmentFixerAgent(org_id=org_id)
