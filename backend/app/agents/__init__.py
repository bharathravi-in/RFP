"""
Agents Package - Google ADK Multi-Agent System

Provides specialized AI agents for RFP analysis:
- DocumentAnalyzerAgent: Analyzes document structure
- QuestionExtractorAgent: Extracts and classifies questions  
- KnowledgeBaseAgent: Retrieves relevant context
- AnswerGeneratorAgent: Generates AI-powered answers
- QualityReviewerAgent: Reviews and validates answers
- OrchestratorAgent: Coordinates the complete workflow
"""

from .config import get_agent_config, SessionKeys, AgentConfig
from .document_analyzer_agent import get_document_analyzer_agent, DocumentAnalyzerAgent
from .question_extractor_agent import get_question_extractor_agent, QuestionExtractorAgent
from .knowledge_base_agent import get_knowledge_base_agent, KnowledgeBaseAgent
from .answer_generator_agent import get_answer_generator_agent, AnswerGeneratorAgent
from .quality_reviewer_agent import get_quality_reviewer_agent, QualityReviewerAgent
from .orchestrator_agent import get_orchestrator_agent, OrchestratorAgent

__all__ = [
    # Config
    "AgentConfig",
    "get_agent_config",
    "SessionKeys",
    # Agents
    "DocumentAnalyzerAgent",
    "QuestionExtractorAgent", 
    "KnowledgeBaseAgent",
    "AnswerGeneratorAgent",
    "QualityReviewerAgent",
    "OrchestratorAgent",
    # Factory functions
    "get_document_analyzer_agent",
    "get_question_extractor_agent",
    "get_knowledge_base_agent",
    "get_answer_generator_agent",
    "get_quality_reviewer_agent",
    "get_orchestrator_agent",
]
