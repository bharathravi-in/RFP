# Models package initialization
from .user import User
from .organization import Organization
from .organization_ai_config import OrganizationAIConfig
from .agent_ai_config import AgentAIConfig
from .project import Project, project_reviewers
from .document import Document
from .question import Question
from .answer import Answer, AnswerComment
from .knowledge import KnowledgeItem
from .knowledge_folder import KnowledgeFolder
from .knowledge_profile import KnowledgeProfile, DimensionValues, project_knowledge_profiles
from .audit_log import AuditLog, ComplianceMapping, ExportHistory
from .rfp_section import RFPSectionType, RFPSection, SectionTemplate, seed_section_types
from .filter_dimension import FilterDimension, seed_filter_dimensions
from .feedback import AnswerEdit, AnswerFeedback, AgentPerformance
from .feedback_learning import FeedbackLearning  # NEW
from .invitation import Invitation
from .proposal_version import ProposalVersion
from .section_version import SectionVersion, save_section_version
from .compliance_item import ComplianceItem
from .answer_library import AnswerLibraryItem
from .notification import Notification
from .comment import Comment
from .activity_log import ActivityLog
from .copilot import CoPilotSession, CoPilotMessage
from .export_template import ExportTemplate
from .project_strategy import ProjectStrategy
from .competitor import Competitor  # Competitor intelligence

# LLM Usage Tracking (from services, not a model file but registered here for convenience)
# Note: LLMUsage is defined in app/services/llm_usage.py

# Document Chat
from .document_chat import DocumentChatSession, DocumentChatMessage

# Webhooks (Enterprise feature)
from .webhook import WebhookConfig, WebhookDelivery, WEBHOOK_EVENTS

__all__ = [
    'User',
    'Organization',
    'OrganizationAIConfig',
    'AgentAIConfig',
    'Project',
    'project_reviewers',
    'Document',
    'Question',
    'Answer',
    'AnswerComment',
    'KnowledgeItem',
    'KnowledgeFolder',
    'KnowledgeProfile',
    'DimensionValues',
    'project_knowledge_profiles',
    'AuditLog',
    'ComplianceMapping',
    'ExportHistory',
    'RFPSectionType',
    'RFPSection',
    'SectionTemplate',
    'seed_section_types',
    # Filter Dimensions
    'FilterDimension',
    'seed_filter_dimensions',
    # Feedback models
    'AnswerEdit',
    'AnswerFeedback',
    'AgentPerformance',
    # Invitations
    'Invitation',
    # Proposal Versions
    'ProposalVersion',
    # Section Versions
    'SectionVersion',
    'save_section_version',
    # Compliance
    'ComplianceItem',
    # Answer Library
    'AnswerLibraryItem',
    # Notifications
    'Notification',
    # Comments
    'Comment',
    # Activity Log
    'ActivityLog',
    # Feedback Learning (AI improvement)
    'FeedbackLearning',
    # Co-Pilot Chat
    'CoPilotSession',
    'CoPilotMessage',
    # Export Templates
    'ExportTemplate',
    # Project Strategy
    'ProjectStrategy',
    # Competitor Intelligence
    'Competitor',
]
