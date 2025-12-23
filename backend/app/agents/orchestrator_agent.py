"""
Orchestrator Agent

Main entry point that coordinates all sub-agents in a sequential workflow
for complete RFP analysis and response generation.
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import get_agent_config, SessionKeys
from .document_analyzer_agent import get_document_analyzer_agent
from .question_extractor_agent import get_question_extractor_agent
from .knowledge_base_agent import get_knowledge_base_agent
from .answer_generator_agent import get_answer_generator_agent
from .answer_validator_agent import get_answer_validator_agent  # NEW
from .compliance_checker_agent import get_compliance_checker_agent  # NEW
from .clarification_agent import get_clarification_agent
from .quality_reviewer_agent import get_quality_reviewer_agent

logger = logging.getLogger(__name__)


class OrchestratorAgent:
    """
    Main orchestrator that coordinates the multi-agent workflow.
    
    Workflow:
    1. Document Analyzer → Extracts structure and themes
    2. Question Extractor → Identifies questions
    3. Knowledge Base → Retrieves context
    4. Answer Generator → Creates draft answers
    4.5. Answer Validator → Validates answers against knowledge (NEW)
    4.6. Compliance Checker → Validates compliance claims (NEW)
    5. Clarification Agent → Identifies questions needing clarification
    6. Quality Reviewer → Reviews and validates
    """
    
    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='default')
        self.name = "OrchestratorAgent"
        
        # Initialize sub-agents
        self.document_analyzer = get_document_analyzer_agent()
        self.question_extractor = get_question_extractor_agent()
        self.knowledge_base = get_knowledge_base_agent()
        self.answer_generator = get_answer_generator_agent()
        self.answer_validator = get_answer_validator_agent()  # NEW
        self.compliance_checker = get_compliance_checker_agent(org_id=org_id)  # NEW
        self.clarification_agent = get_clarification_agent()
        self.quality_reviewer = get_quality_reviewer_agent()
    
    def analyze_rfp(
        self,
        document_text: str,
        org_id: int = None,
        project_id: int = None,  # NEW: Pass to KB agent for dimension filtering
        options: Dict = None
    ) -> Dict:
        """
        Run the complete RFP analysis workflow.
        
        Args:
            document_text: Extracted text from the RFP document
            org_id: Organization ID for knowledge base scoping
            project_id: Project ID for auto-fetching dimensions (NEW)
            options: Configuration options (tone, length, etc.)
            
        Returns:
            Complete analysis results with answers
        """
        options = options or {}
        
        # Initialize session state for agent communication
        session_state = {
            SessionKeys.AGENT_MESSAGES: [],
            SessionKeys.CURRENT_STEP: "initializing",
            SessionKeys.ERRORS: [],
            "started_at": datetime.utcnow().isoformat(),
            "org_id": org_id
        }
        
        result = {
            "success": False,
            "steps_completed": [],
            "document_analysis": None,
            "questions": [],
            "answers": [],
            "stats": {},
            "agent_log": []
        }
        
        try:
            # Step 1: Analyze Document
            session_state[SessionKeys.CURRENT_STEP] = "analyzing_document"
            logger.info("Step 1: Analyzing document structure...")
            
            doc_result = self.document_analyzer.analyze(
                document_text=document_text,
                session_state=session_state
            )
            
            if not doc_result.get("success"):
                result["error"] = "Document analysis failed"
                return self._finalize_result(result, session_state)
            
            result["document_analysis"] = doc_result.get("analysis")
            result["steps_completed"].append("document_analysis")
            session_state = doc_result.get("session_state", session_state)
            
            # Step 2: Extract Questions
            session_state[SessionKeys.CURRENT_STEP] = "extracting_questions"
            logger.info("Step 2: Extracting questions...")
            
            question_result = self.question_extractor.extract(
                session_state=session_state
            )
            
            if not question_result.get("success"):
                result["error"] = "Question extraction failed"
                return self._finalize_result(result, session_state)
            
            result["questions"] = question_result.get("questions", [])
            result["steps_completed"].append("question_extraction")
            session_state = question_result.get("session_state", session_state)
            
            # Step 3: Retrieve Knowledge Context
            session_state[SessionKeys.CURRENT_STEP] = "retrieving_knowledge"
            logger.info("Step 3: Retrieving knowledge context...")
            
            kb_result = self.knowledge_base.retrieve_context(
                org_id=org_id,
                project_id=project_id,  # NEW: Auto-fetch project dimensions
                session_state=session_state
            )
            
            # Knowledge retrieval can fail gracefully
            result["steps_completed"].append("knowledge_retrieval")
            session_state = kb_result.get("session_state", session_state)
            
            # Step 4: Generate Answers
            session_state[SessionKeys.CURRENT_STEP] = "generating_answers"
            logger.info("Step 4: Generating answers...")
            
            answer_result = self.answer_generator.generate_answers(
                tone=options.get("tone", "professional"),
                length=options.get("length", "medium"),
                session_state=session_state
            )
            
            if not answer_result.get("success"):
                result["error"] = "Answer generation failed"
                return self._finalize_result(result, session_state)
            
            result["steps_completed"].append("answer_generation")
            session_state = answer_result.get("session_state", session_state)
            
            # Step 4.5: Validate Answers (NEW - prevents hallucinations)
            session_state[SessionKeys.CURRENT_STEP] = "validating_answers"
            logger.info("Step 4.5: Validating answers against knowledge base...")
            
            validation_result = self.answer_validator.validate_answers(
                session_state=session_state
            )
            
            # Validation is optional - continue even if it fails
            if validation_result.get("success"):
                result["validation_stats"] = validation_result.get("stats", {})
                result["steps_completed"].append("answer_validation")
                # Use validated answers if available
                validated_answers = validation_result.get("validated_answers", [])
                if validated_answers:
                    session_state[SessionKeys.DRAFT_ANSWERS] = validated_answers
            else:
                result["steps_completed"].append("answer_validation_skipped")
            
            session_state = validation_result.get("session_state", session_state)
            
            # Step 4.6: Check Compliance (NEW - validates regulatory claims)
            session_state[SessionKeys.CURRENT_STEP] = "checking_compliance"
            logger.info("Step 4.6: Checking compliance claims...")
            
            compliance_result = self.compliance_checker.check_compliance(
                session_state=session_state
            )
            
            # Compliance check is optional
            if compliance_result.get("success"):
                result["compliance_stats"] = compliance_result.get("stats", {})
                result["compliance_issues"] = compliance_result.get("compliance_issues", [])
                result["steps_completed"].append("compliance_check")
            else:
                result["compliance_issues"] = []
                result["steps_completed"].append("compliance_check_skipped")
            
            session_state = compliance_result.get("session_state", session_state)
            
            # Step 5: Identify Clarifications
            session_state[SessionKeys.CURRENT_STEP] = "identifying_clarifications"
            logger.info("Step 5: Identifying clarification needs...")
            
            clarification_result = self.clarification_agent.analyze_questions(
                confidence_threshold=0.5,
                session_state=session_state
            )
            
            # Clarifications are optional - don't fail if this step has issues
            if clarification_result.get("success"):
                result["clarifications"] = clarification_result.get("clarifications", [])
                result["steps_completed"].append("clarification_detection")
            else:
                result["clarifications"] = []
                result["steps_completed"].append("clarification_detection_skipped")
            
            session_state = clarification_result.get("session_state", session_state)
            
            # Step 6: Review Answers
            session_state[SessionKeys.CURRENT_STEP] = "reviewing_answers"
            logger.info("Step 6: Reviewing answers...")
            
            review_result = self.quality_reviewer.review_answers(
                session_state=session_state
            )
            
            if review_result.get("success"):
                result["answers"] = review_result.get("reviewed_answers", [])
                result["steps_completed"].append("quality_review")
                result["stats"] = review_result.get("stats", {})
            else:
                # Use draft answers if review fails
                result["answers"] = session_state.get(SessionKeys.DRAFT_ANSWERS, [])
                result["steps_completed"].append("quality_review_skipped")
            
            session_state = review_result.get("session_state", session_state)
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Orchestration error: {e}")
            result["error"] = str(e)
            session_state[SessionKeys.ERRORS].append(str(e))
        
        return self._finalize_result(result, session_state)
    
    def _finalize_result(self, result: Dict, session_state: Dict) -> Dict:
        """Finalize the result with session data."""
        result["agent_log"] = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        result["completed_at"] = datetime.utcnow().isoformat()
        result["errors"] = session_state.get(SessionKeys.ERRORS, [])
        return result
    
    def analyze_document_only(self, document_text: str) -> Dict:
        """Run only document analysis step."""
        session_state = {SessionKeys.AGENT_MESSAGES: []}
        return self.document_analyzer.analyze(document_text, session_state)
    
    def extract_questions_only(self, document_text: str) -> Dict:
        """Run document analysis and question extraction."""
        session_state = {SessionKeys.AGENT_MESSAGES: []}
        
        # Analyze first
        self.document_analyzer.analyze(document_text, session_state)
        
        # Then extract
        return self.question_extractor.extract(session_state=session_state)
    
    def generate_answers_for_questions(
        self,
        questions: List[Dict],
        org_id: int = None,
        project_id: int = None,  # NEW
        options: Dict = None
    ) -> Dict:
        """Generate answers for provided questions without document analysis."""
        options = options or {}
        session_state = {
            SessionKeys.AGENT_MESSAGES: [],
            SessionKeys.EXTRACTED_QUESTIONS: questions
        }
        
        # Get knowledge context
        self.knowledge_base.retrieve_context(
            questions=questions,
            org_id=org_id,
            project_id=project_id,  # NEW
            session_state=session_state
        )
        
        # Generate answers
        answer_result = self.answer_generator.generate_answers(
            tone=options.get("tone", "professional"),
            length=options.get("length", "medium"),
            session_state=session_state
        )
        
        # Review if generation succeeded
        if answer_result.get("success"):
            review_result = self.quality_reviewer.review_answers(
                session_state=session_state
            )
            if review_result.get("success"):
                return review_result
        
        return answer_result


def get_orchestrator_agent() -> OrchestratorAgent:
    """Factory function to get the Orchestrator Agent."""
    return OrchestratorAgent()
