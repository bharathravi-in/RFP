"""
Celery Tasks for Async Agent Operations

Provides background task execution for long-running RFP analysis operations.
"""
import logging
from typing import Dict, Any
from celery import Task, current_task
from datetime import datetime

from app.extensions import db
from app.agents import get_orchestrator_agent

logger = logging.getLogger(__name__)


class ProgressTask(Task):
    """Custom Celery task that reports progress."""
    
    def update_progress(self, state: str, meta: Dict[str, Any]):
        """Update task progress in Celery result backend."""
        if current_task:
            current_task.update_state(state=state, meta=meta)


def create_celery_tasks(celery_app):
    """
    Create Celery tasks with the app context.
    
    Args:
        celery_app: Initialized Celery app instance
    """
    
    @celery_app.task(bind=True, base=ProgressTask, name='agents.analyze_rfp_async')
    def analyze_rfp_async(
        self,
        document_text: str,
        org_id: int = None,
        project_id: int = None,
        options: Dict = None
    ) -> Dict:
        """
        Async version of RFP analysis workflow.
        
        Reports progress updates at each step for real-time tracking.
        
        Args:
            document_text: RFP document text
            org_id: Organization ID
            project_id: Project ID for dimension filtering
            options: Analysis options (tone, length, etc.)
            
        Returns:
            Complete analysis results
        """
        options = options or {}
        
        try:
            # Initialize orchestrator
            orchestrator = get_orchestrator_agent()
            
            # Update: Starting analysis
            self.update_progress('PROGRESS', {
                'current_step': 0,
                'total_steps': 5,
                'status': 'Starting RFP analysis...',
                'started_at': datetime.utcnow().isoformat()
            })
            
            # We'll override the orchestrator to report progress
            # Wrap each step with progress updates
            
            # Step 1: Document Analysis
            self.update_progress('PROGRESS', {
                'current_step': 1,
                'total_steps': 5,
                'status': 'Analyzing document structure...',
                'progress_percent': 20
            })
            
            doc_result = orchestrator.document_analyzer.analyze(
                document_text=document_text,
                session_state={}
            )
            
            if not doc_result.get("success"):
                raise Exception("Document analysis failed")
            
            session_state = doc_result.get("session_state", {})
            
            # Step 2: Question Extraction
            self.update_progress('PROGRESS', {
                'current_step': 2,
                'total_steps': 5,
                'status': 'Extracting questions...',
                'progress_percent': 40
            })
            
            question_result = orchestrator.question_extractor.extract(
                session_state=session_state
            )
            
            if not question_result.get("success"):
                raise Exception("Question extraction failed")
            
            session_state = question_result.get("session_state", session_state)
            questions = question_result.get("questions", [])
            
            # Step 3: Knowledge Retrieval
            self.update_progress('PROGRESS', {
                'current_step': 3,
                'total_steps': 5,
                'status': f'Retrieving knowledge for {len(questions)} questions...',
                'progress_percent': 60
            })
            
            kb_result = orchestrator.knowledge_base.retrieve_context(
                org_id=org_id,
                project_id=project_id,
                session_state=session_state
            )
            
            session_state = kb_result.get("session_state", session_state)
            
            # Step 4: Answer Generation
            self.update_progress('PROGRESS', {
                'current_step': 4,
                'total_steps': 5,
                'status': f'Generating answers to {len(questions)} questions...',
                'progress_percent': 80
            })
            
            answer_result = orchestrator.answer_generator.generate_answers(
                tone=options.get("tone", "professional"),
                length=options.get("length", "medium"),
                session_state=session_state
            )
            
            if not answer_result.get("success"):
                raise Exception("Answer generation failed")
            
            session_state = answer_result.get("session_state", session_state)
            
            # Step 4.5: Clarification Detection
            clarification_result = orchestrator.clarification_agent.analyze_questions(
                confidence_threshold=0.5,
                session_state=session_state
            )
            
            clarifications = clarification_result.get("clarifications", []) if clarification_result.get("success") else []
            session_state = clarification_result.get("session_state", session_state)
            
            # Step 5: Quality Review
            self.update_progress('PROGRESS', {
                'current_step': 5,
                'total_steps': 5,
                'status': 'Reviewing answer quality...',
                'progress_percent': 95
            })
            
            review_result = orchestrator.quality_reviewer.review_answers(
                session_state=session_state
            )
            
            if review_result.get("success"):
                answers = review_result.get("reviewed_answers", [])
                stats = review_result.get("stats", {})
            else:
                # Fallback to draft answers
                from app.agents.config import SessionKeys
                answers = session_state.get(SessionKeys.DRAFT_ANSWERS, [])
                stats = {}
            
            # Complete
            result = {
                "success": True,
                "steps_completed": ["document_analysis", "question_extraction", "knowledge_retrieval", 
                                  "answer_generation", "clarification_detection", "quality_review"],
                "document_analysis": doc_result.get("analysis"),
                "questions": questions,
                "answers": answers,
                "clarifications": clarifications,
                "stats": stats,
                "agent_log": session_state.get("agent_messages", []),
                "completed_at": datetime.utcnow().isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Async RFP analysis failed: {str(e)}", exc_info=True)
            self.update_progress('FAILURE', {
                'error': str(e),
                'failed_at': datetime.utcnow().isoformat()
            })
            raise
    
    
    @celery_app.task(bind=True, name='agents.generate_answers_async')
    def generate_answers_async(
        self,
        questions: list,
        org_id: int = None,
        project_id: int = None,
        options: Dict = None
    ) -> Dict:
        """
        Async answer generation for provided questions.
        
        Args:
            questions: List of questions to answer
            org_id: Organization ID
            project_id: Project ID
            options: Generation options
            
        Returns:
            Generated answers
        """
        options = options or {}
        
        try:
            orchestrator = get_orchestrator_agent()
            
            self.update_progress('PROGRESS', {
                'status': f'Generating answers for {len(questions)} questions...',
                'progress_percent': 10
            })
            
            result = orchestrator.generate_answers_for_questions(
                questions=questions,
                org_id=org_id,
                project_id=project_id,
                options=options
            )
            
            self.update_progress('PROGRESS', {
                'status': 'Completed',
                'progress_percent': 100
            })
            
            return result
            
        except Exception as e:
            logger.error(f"Async answer generation failed: {str(e)}", exc_info=True)
            self.update_progress('FAILURE', {'error': str(e)})
            raise
    
    return {
        'analyze_rfp_async': analyze_rfp_async,
        'generate_answers_async': generate_answers_async
    }
