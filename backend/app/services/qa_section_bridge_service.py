"""
Q&A-to-Section Bridge Service

Bridges the gap between Q&A workflow answers and Proposal Builder sections.
Maps approved Q&A answers to relevant proposal sections.
"""
import logging
from typing import Dict, List, Any, Optional
from sqlalchemy import and_

from app import db
from app.models.question import Question
from app.models.answer import Answer
from app.models.rfp_section import RFPSection, RFPSectionType
from app.models.project import Project
from app.agents.rfp_section_alignment_agent import get_rfp_section_alignment_agent

logger = logging.getLogger(__name__)


class QASectionBridgeService:
    """
    Service to connect Q&A workflow answers with Proposal Builder sections.
    
    Key Features:
    1. Map Q&A answers to proposal sections based on category/content
    2. Auto-populate Q&A Responses section with approved answers
    3. Inject relevant Q&A context into narrative sections
    """
    
    # Mapping of Q&A categories to section type slugs
    CATEGORY_TO_SECTION_MAP = {
        'security': ['compliance', 'technical_approach'],
        'compliance': ['compliance'],
        'technical': ['technical_approach', 'implementation'],
        'pricing': ['pricing'],
        'legal': ['terms_conditions', 'appendix'],
        'product': ['technical_approach', 'solution_overview'],
        'support': ['implementation', 'support'],
        'integration': ['technical_approach', 'implementation'],
        'general': ['qa_responses', 'executive_summary'],
    }
    
    def get_project_qa_answers(
        self, 
        project_id: int, 
        status_filter: List[str] = None
    ) -> List[Dict]:
        """
        Get all Q&A answers for a project.
        
        Args:
            project_id: Project ID
            status_filter: Optional list of statuses to filter (e.g., ['approved', 'answered'])
            
        Returns:
            List of Q&A answer dictionaries
        """
        if status_filter is None:
            status_filter = ['approved', 'answered']
        
        questions = Question.query.filter(
            and_(
                Question.project_id == project_id,
                Question.status.in_(status_filter)
            )
        ).order_by(Question.order, Question.id).all()
        
        qa_list = []
        for q in questions:
            if q.answer:
                qa_list.append({
                    'question_id': q.id,
                    'question_text': q.text,
                    'category': q.category or 'general',
                    'sub_category': q.sub_category,
                    'priority': q.priority,
                    'section': q.section,
                    'status': q.status,
                    'answer_id': q.answer.id,
                    'answer_content': q.answer.content,
                    'confidence_score': q.answer.confidence_score,
                    'is_ai_generated': q.answer.is_ai_generated,
                    'sources': q.answer.sources or [],
                })
        
        return qa_list
    
    def map_answers_to_sections(
        self, 
        project_id: int,
        use_ai_mapping: bool = True
    ) -> Dict[str, List[Dict]]:
        """
        Map Q&A answers to proposal sections.
        
        Args:
            project_id: Project ID
            use_ai_mapping: Whether to use AI for intelligent mapping
            
        Returns:
            Dictionary mapping section slugs to lists of Q&A answers
        """
        qa_answers = self.get_project_qa_answers(project_id)
        
        if not qa_answers:
            return {}
        
        # Get existing sections for the project
        existing_sections = RFPSection.query.filter_by(project_id=project_id).all()
        existing_slugs = {s.section_type.slug for s in existing_sections if s.section_type}
        
        # Initialize mapping
        section_mapping: Dict[str, List[Dict]] = {}
        
        if use_ai_mapping:
            try:
                # Use AI agent for intelligent mapping
                alignment_agent = get_rfp_section_alignment_agent()
                project = Project.query.get(project_id)
                
                # Build question list for alignment agent
                questions_for_mapping = [
                    {'id': qa['question_id'], 'text': qa['question_text'], 'category': qa['category']}
                    for qa in qa_answers
                ]
                
                # Get document text if available
                doc_text = ""
                if project and project.documents:
                    primary_doc = next((d for d in project.documents if d.is_primary), None)
                    if primary_doc and primary_doc.content:
                        doc_text = primary_doc.content[:10000]  # Limit for performance
                
                # Use alignment agent
                if doc_text:
                    alignment_result = alignment_agent.align_rfp_to_sections(
                        rfp_text=doc_text,
                        project_id=project_id
                    )
                    
                    if alignment_result.get('success') and alignment_result.get('mappings'):
                        for mapping in alignment_result['mappings']:
                            section_slug = mapping.get('section_id', 'qa_responses')
                            if section_slug not in section_mapping:
                                section_mapping[section_slug] = []
                            
                            # Find matching Q&A answers
                            for qid in mapping.get('question_ids', []):
                                qa = next((a for a in qa_answers if a['question_id'] == qid), None)
                                if qa:
                                    section_mapping[section_slug].append(qa)
                        
                        return section_mapping
            except Exception as e:
                logger.warning(f"AI mapping failed, falling back to category-based: {e}")
        
        # Fallback: Category-based mapping
        for qa in qa_answers:
            category = qa.get('category', 'general')
            target_sections = self.CATEGORY_TO_SECTION_MAP.get(category, ['qa_responses'])
            
            # Use first matching existing section, or default to qa_responses
            placed = False
            for section_slug in target_sections:
                if section_slug in existing_slugs:
                    if section_slug not in section_mapping:
                        section_mapping[section_slug] = []
                    section_mapping[section_slug].append(qa)
                    placed = True
                    break
            
            # If no matching section exists, add to qa_responses
            if not placed:
                if 'qa_responses' not in section_mapping:
                    section_mapping['qa_responses'] = []
                section_mapping['qa_responses'].append(qa)
        
        return section_mapping
    
    def populate_qa_responses_section(
        self, 
        project_id: int,
        create_if_missing: bool = True
    ) -> Optional[RFPSection]:
        """
        Create/update the Q&A Responses section with all approved answers.
        
        Args:
            project_id: Project ID
            create_if_missing: Create section if it doesn't exist
            
        Returns:
            Updated or created RFPSection
        """
        qa_answers = self.get_project_qa_answers(project_id, status_filter=['approved', 'answered'])
        
        if not qa_answers:
            logger.info(f"No Q&A answers found for project {project_id}")
            return None
        
        # Find or create Q&A Responses section type
        qa_section_type = RFPSectionType.query.filter_by(slug='qa_responses').first()
        if not qa_section_type:
            # Create the section type if it doesn't exist
            qa_section_type = RFPSectionType(
                name='Q&A Responses',
                slug='qa_responses',
                description='Compiled Q&A responses from the RFP',
                is_default=True
            )
            db.session.add(qa_section_type)
            db.session.commit()
        
        # Find existing Q&A section for this project
        qa_section = RFPSection.query.filter(
            and_(
                RFPSection.project_id == project_id,
                RFPSection.section_type_id == qa_section_type.id
            )
        ).first()
        
        if not qa_section and create_if_missing:
            # Create new section
            max_order = db.session.query(db.func.max(RFPSection.order)).filter_by(
                project_id=project_id
            ).scalar() or 0
            
            qa_section = RFPSection(
                project_id=project_id,
                section_type_id=qa_section_type.id,
                title='Q&A Responses',
                order=max_order + 1,
                status='generated'
            )
            db.session.add(qa_section)
        
        if qa_section:
            # Generate content from Q&A answers
            content_parts = ["# Q&A Responses\n\n"]
            content_parts.append("This section contains responses to specific questions from the RFP.\n\n")
            
            # Group by category
            by_category: Dict[str, List[Dict]] = {}
            for qa in qa_answers:
                cat = qa.get('category', 'general')
                if cat not in by_category:
                    by_category[cat] = []
                by_category[cat].append(qa)
            
            # Build formatted content
            for category, items in by_category.items():
                content_parts.append(f"## {category.replace('_', ' ').title()}\n\n")
                
                for qa in items:
                    content_parts.append(f"### Q: {qa['question_text']}\n\n")
                    content_parts.append(f"{qa['answer_content']}\n\n")
                    
                    if qa.get('confidence_score') and qa['confidence_score'] < 0.7:
                        content_parts.append("_Note: This response may require additional review._\n\n")
                    
                    content_parts.append("---\n\n")
            
            qa_section.content = ''.join(content_parts)
            qa_section.status = 'generated'
            
            # Store metadata
            qa_section.inputs = {
                'auto_populated': True,
                'qa_count': len(qa_answers),
                'categories': list(by_category.keys())
            }
            
            db.session.commit()
            logger.info(f"Populated Q&A section with {len(qa_answers)} answers for project {project_id}")
        
        return qa_section
    
    def inject_qa_context_into_section(
        self, 
        section_id: int,
        qa_answers: List[Dict] = None
    ) -> Dict:
        """
        Inject relevant Q&A answers as context into a narrative section.
        
        Args:
            section_id: Target section ID
            qa_answers: Optional pre-filtered Q&A answers (if None, auto-selects)
            
        Returns:
            Result dictionary with injected content info
        """
        section = RFPSection.query.get(section_id)
        if not section:
            return {'success': False, 'error': 'Section not found'}
        
        if qa_answers is None:
            # Get relevant Q&A answers based on section type
            section_slug = section.section_type.slug if section.section_type else None
            all_qa = self.get_project_qa_answers(section.project_id)
            
            # Filter by relevant categories
            relevant_categories = []
            for cat, slugs in self.CATEGORY_TO_SECTION_MAP.items():
                if section_slug in slugs:
                    relevant_categories.append(cat)
            
            qa_answers = [
                qa for qa in all_qa 
                if qa.get('category') in relevant_categories
            ]
        
        if not qa_answers:
            return {'success': True, 'message': 'No relevant Q&A answers found', 'count': 0}
        
        # Build context block
        context_block = "\n\n---\n\n## Related Q&A Responses\n\n"
        context_block += "_The following Q&A responses are relevant to this section:_\n\n"
        
        for qa in qa_answers[:5]:  # Limit to top 5
            context_block += f"**Q:** {qa['question_text']}\n\n"
            # Truncate long answers
            answer = qa['answer_content']
            if len(answer) > 500:
                answer = answer[:500] + "..."
            context_block += f"**A:** {answer}\n\n"
        
        # Append to section content
        current_content = section.content or ''
        if 'Related Q&A Responses' not in current_content:
            section.content = current_content + context_block
            db.session.commit()
        
        return {
            'success': True,
            'message': f'Injected {len(qa_answers)} Q&A answers',
            'count': len(qa_answers)
        }
    
    def get_section_qa_mapping_preview(self, project_id: int) -> Dict:
        """
        Get a preview of how Q&A answers would map to sections.
        
        Returns:
            Preview data for UI display
        """
        mapping = self.map_answers_to_sections(project_id, use_ai_mapping=False)
        
        # Get section type info
        section_types = {st.slug: st.name for st in RFPSectionType.query.all()}
        
        preview = {
            'project_id': project_id,
            'total_answers': sum(len(answers) for answers in mapping.values()),
            'sections': []
        }
        
        for slug, answers in mapping.items():
            preview['sections'].append({
                'slug': slug,
                'name': section_types.get(slug, slug.replace('_', ' ').title()),
                'answer_count': len(answers),
                'answers': [
                    {
                        'question_id': a['question_id'],
                        'question_preview': a['question_text'][:100] + ('...' if len(a['question_text']) > 100 else ''),
                        'category': a['category']
                    }
                    for a in answers
                ]
            })
        
        return preview


# Singleton instance
qa_section_bridge_service = QASectionBridgeService()


def get_qa_section_bridge_service() -> QASectionBridgeService:
    """Get the Q&A Section Bridge service instance."""
    return qa_section_bridge_service
