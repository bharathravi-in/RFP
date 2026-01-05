"""
Multi-Agent System for RFP Analysis using Google ADK

This module contains specialized agents that work together to:
1. Analyze RFP documents
2. Extract and classify questions 
3. Retrieve relevant knowledge
4. Generate high-quality answers
5. Validate answers against knowledge
6. Check compliance claims
7. Learn from user feedback (NEW)
8. Map questions to sections (NEW)
9. Review and validate responses
10. Identify clarification needs

Main entry point: OrchestratorAgent
"""

from .content_freshness_agent import (
    ContentFreshnessAgent,
    get_content_freshness_agent
)
from .expert_routing_agent import (
    ExpertRoutingAgent,
    get_expert_routing_agent
)
from .config import get_agent_config, SessionKeys
from .document_analyzer_agent import (
    DocumentAnalyzerAgent,
    get_document_analyzer_agent
)
from .question_extractor_agent import (
    QuestionExtractorAgent,
    get_question_extractor_agent
)
from .knowledge_base_agent import (
    KnowledgeBaseAgent,
    get_knowledge_base_agent
)
from .answer_generator_agent import (
    AnswerGeneratorAgent,
    get_answer_generator_agent
)
from .answer_validator_agent import (
    AnswerValidatorAgent,
    get_answer_validator_agent
)
from .compliance_checker_agent import (
    ComplianceCheckerAgent,
    get_compliance_checker_agent
)
from .feedback_learning_agent import (
    FeedbackLearningAgent,
    get_feedback_learning_agent
)
from .section_mapper_agent import (
    SectionMapperAgent,
    get_section_mapper_agent
)
from .quality_reviewer_agent import (
    QualityReviewerAgent,
    get_quality_reviewer_agent
)
from .clarification_agent import (
    ClarificationAgent,
    get_clarification_agent
)
from .orchestrator_agent import (
    OrchestratorAgent,
    get_orchestrator_agent
)
from .diagram_generator_agent import (
    DiagramGeneratorAgent,
    get_diagram_generator_agent,
    DiagramType,
    DIAGRAM_TYPE_INFO
)
from .ppt_generator_agent import PPTGeneratorAgent, get_ppt_generator_agent
from .doc_generator_agent import DOCGeneratorAgent, get_doc_generator_agent
from .proposal_writer_agent import ProposalWriterAgent, get_proposal_writer_agent
from .proposal_quality_gate_agent import ProposalQualityGateAgent, get_proposal_quality_gate_agent
from .executive_editor_agent import ExecutiveEditorAgent, get_executive_editor_agent
from .similarity_validator_agent import SimilarityValidatorAgent, get_similarity_validator_agent
from .rfp_section_alignment_agent import RFPSectionAlignmentAgent, get_rfp_section_alignment_agent
from .rfp_section_alignment_fixer_agent import RFPSectionAlignmentFixerAgent, get_rfp_alignment_fixer
from .pricing_calculator_agent import PricingCalculatorAgent, get_pricing_calculator_agent
from .legal_review_agent import LegalReviewAgent, get_legal_review_agent
from .win_theme_agent import WinThemeAgent, get_win_theme_agent
from .competitive_analysis_agent import CompetitiveAnalysisAgent, get_competitive_analysis_agent
from .metrics_service import (
    AgentMetricsService,
    get_metrics_service,
    MetricType
)


__all__ = [
    'get_agent_config',
    'SessionKeys',
    'DocumentAnalyzerAgent',
    'get_document_analyzer_agent',
    'QuestionExtractorAgent',
    'get_question_extractor_agent',
    'KnowledgeBaseAgent',
    'get_knowledge_base_agent',
    'AnswerGeneratorAgent',
    'get_answer_generator_agent',
    'AnswerValidatorAgent',
    'get_answer_validator_agent',
    'ComplianceCheckerAgent',
    'get_compliance_checker_agent',
    'FeedbackLearningAgent',
    'get_feedback_learning_agent',
    'SectionMapperAgent',
    'get_section_mapper_agent',
    'QualityReviewerAgent',
    'get_quality_reviewer_agent',
    'ClarificationAgent',
    'get_clarification_agent',
    'OrchestratorAgent',
    'get_orchestrator_agent',
    'ExpertRoutingAgent',
    'get_expert_routing_agent',
    'ContentFreshnessAgent',
    'get_content_freshness_agent',
    'DiagramGeneratorAgent',
    'get_diagram_generator_agent',
    'DiagramType',
    'DIAGRAM_TYPE_INFO',
    'PPTGeneratorAgent',
    'get_ppt_generator_agent',
    'DOCGeneratorAgent',
    'get_doc_generator_agent',
    'ProposalWriterAgent',
    'get_proposal_writer_agent',
    # New Quality & Validation Agents
    'ProposalQualityGateAgent',
    'get_proposal_quality_gate_agent',
    'ExecutiveEditorAgent',
    'get_executive_editor_agent',
    'SimilarityValidatorAgent',
    'get_similarity_validator_agent',
    # RFP Section Alignment
    'RFPSectionAlignmentAgent',
    'get_rfp_section_alignment_agent',
    # Business Agents
    'PricingCalculatorAgent',
    'get_pricing_calculator_agent',
    'LegalReviewAgent',
    'get_legal_review_agent',
    # Strategy Agents
    'WinThemeAgent',
    'get_win_theme_agent',
    'CompetitiveAnalysisAgent',
    'get_competitive_analysis_agent',
    # Metrics & Observability
    'AgentMetricsService',
    'get_metrics_service',
    'MetricType',
]



