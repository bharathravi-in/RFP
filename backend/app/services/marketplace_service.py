"""
Marketplace Service

Handles interaction with the Template Marketplace and Knowledge Packs.
- Browse templates
- Install templates (creates new project)
- Install industry knowledge packs (seeds answer library)

Phase 4: Market Leader
"""
import logging
import json
from datetime import datetime
from typing import List, Dict, Any

from ..extensions import db
from ..models import Project, Question, RFPSection, AnswerLibraryItem, User, Organization
from ..models.proposal_template import ProposalTemplate

logger = logging.getLogger(__name__)


class MarketplaceService:
    """Service for marketplace operations."""
    
    def __init__(self, user_id: int, organization_id: int):
        self.user_id = user_id
        self.organization_id = organization_id
        self.user = User.query.get(user_id)
        
    def get_templates(self, category: str = None) -> List[Dict[str, Any]]:
        """
        Get available templates.
        
        Args:
            category: Filter by category (optional)
        """
        query = ProposalTemplate.query.filter(
            (ProposalTemplate.is_public == True) | 
            (ProposalTemplate.organization_id == self.organization_id)
        )
        
        if category:
            query = query.filter(ProposalTemplate.category == category)
            
        return [t.to_dict() for t in query.order_by(ProposalTemplate.install_count.desc()).all()]
    
    def install_template(self, template_id: int, project_name: str) -> Project:
        """
        Create a new project from a template.
        
        Args:
            template_id: ID of the template to install
            project_name: Name for the new project
            
        Returns:
            The created Project object
        """
        template = ProposalTemplate.query.get(template_id)
        if not template:
            raise ValueError("Template not found")
        
        # Check permissions (e.g. if premium)
        if template.is_premium and not self._check_premium_access():
            raise PermissionError("Premium subscription required for this template")
            
        # Create new project
        project = Project(
            name=project_name,
            description=f"Created from template: {template.title}",
            status='draft',
            created_by=self.user_id,
            organization_id=self.organization_id,
            completion_percent=0.0
        )
        db.session.add(project)
        db.session.flush()  # Get ID
        
        # Parse structure and create sections/questions
        structure = template.content_structure
        sections_data = structure.get('sections', [])
        
        for i, sec_data in enumerate(sections_data):
            # Create Section
            section = RFPSection(
                project_id=project.id,
                title=sec_data.get('title', f"Section {i+1}"),
                order=i,
                status='draft',
                assigned_to=self.user_id
            )
            db.session.add(section)
            db.session.flush()
            
            # Create Questions
            questions_data = sec_data.get('questions', [])
            for q_data in questions_data:
                question = Question(
                    project_id=project.id,
                    section=section.title,
                    question_text=q_data.get('text', ''),
                    status='unanswered',
                    assigned_to=self.user_id
                )
                
                # If template has default answer, set it (but status remains draft/unanswered generally, 
                # or we could set it to 'answered' if it's a standard boilerplate)
                default_answer = q_data.get('default_answer')
                if default_answer:
                    # Create an Answer object? Or just store as pending draft?
                    # For simplicty in this model, let's just make it a suggestion or "pre-filled" answer
                    # requires creating an Answer object linked to question
                    pass 
                    
                db.session.add(question)
        
        # Update install count
        template.install_count += 1
        
        db.session.commit()
        logger.info(f"[MARKETPLACE] Installed template {template.id} fororg {self.organization_id}")
        return project

    def install_knowledge_pack(self, pack_id: str) -> Dict[str, Any]:
        """
        Install an Industry Knowledge Pack.
        
        This seeds the Answer Library with pre-approved Q&A pairs for a specific industry.
        Real implementation would fetch from a central repository or JSON file.
        
        Args:
            pack_id: ID of the pack (e.g., 'saas-security', 'healthcare-hipaa')
        """
        pack_data = self._get_knowledge_pack_content(pack_id)
        if not pack_data:
            raise ValueError("Invalid knowledge pack ID")
            
        count = 0
        for item in pack_data.get('items', []):
            # Check if similar item already exists to avoid dupes? 
            # For now, simple insert
            
            lib_item = AnswerLibraryItem(
                organization_id=self.organization_id,
                question=item['question'],
                answer=item['answer'],
                category=pack_data.get('category', 'General'),
                tags=item.get('tags', []) + ['knowledge-pack'],
                is_active=True,
                created_by=self.user_id,
                times_used=0,
                times_helpful=0
            )
            db.session.add(lib_item)
            count += 1
            
        db.session.commit()
        return {
            'success': True,
            'items_installed': count,
            'pack_name': pack_data.get('name')
        }

    def _get_knowledge_pack_content(self, pack_id: str) -> Dict:
        """
        Mock repository of knowledge packs.
        In production this would query a central content API.
        """
        packs = {
            'saas-security': {
                'name': 'SaaS Security Essentials',
                'category': 'Security',
                'items': [
                    {
                        'question': 'Are you SOC 2 Type II compliant?',
                        'answer': 'Yes, we are SOC 2 Type II compliant. Our report is available upon request under NDA.',
                        'tags': ['compliance', 'soc2']
                    },
                    {
                        'question': 'Is data encrypted at rest?',
                        'answer': 'Yes, data is encrypted at rest using AES-256 encryption.',
                        'tags': ['security', 'encryption']
                    },
                    {
                        'question': 'Do you support SSO?',
                        'answer': 'Yes, we support SAML 2.0 based SSO (Okta, Azure AD, etc.) for Enterprise plans.',
                        'tags': ['security', 'auth']
                    }
                ]
            },
            'gdpr-compliance': {
                'name': 'GDPR Compliance Pack',
                'category': 'Legal',
                'items': [
                    {
                        'question': 'Are you GDPR compliant?',
                        'answer': 'Yes, we are fully GDPR compliant. We act as a Data Processor.',
                        'tags': ['compliance', 'gdpr']
                    },
                    {
                        'question': 'Where is data stored?',
                        'answer': 'Our data centers are located in AWS us-east-1 (N. Virginia). EU residency options available.',
                        'tags': ['infrastructure', 'location']
                    }
                ]
            }
        }
        return packs.get(pack_id)

    def _check_premium_access(self) -> bool:
        """Check if organization has premium plan."""
        # For hackathon, assume everyone is premium or check org plan
        return True


# Factory
def get_marketplace_service(user_id: int, organization_id: int) -> MarketplaceService:
    return MarketplaceService(user_id, organization_id)
