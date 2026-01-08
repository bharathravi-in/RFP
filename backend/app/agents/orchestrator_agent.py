"""
Orchestrator Agent

Main entry point that coordinates all sub-agents in a sequential workflow
for complete RFP analysis and response generation.

Enhanced with Narrative Control Layer (P0):
- ProposalNarrativeArchitectAgent runs FIRST to establish narrative foundation
- All content agents receive narrative_context for coherence
- ProposalDepthScoringAgent validates section quality
- ExecutiveConfidenceGateAgent provides final go/no-go assessment
- Regeneration loop for low-scoring sections
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import get_agent_config, SessionKeys
from .document_analyzer_agent import get_document_analyzer_agent
from .question_extractor_agent import get_question_extractor_agent
from .knowledge_base_agent import get_knowledge_base_agent
from .answer_generator_agent import get_answer_generator_agent
from .answer_validator_agent import get_answer_validator_agent
from .compliance_checker_agent import get_compliance_checker_agent
from .clarification_agent import get_clarification_agent
from .quality_reviewer_agent import get_quality_reviewer_agent
from .proposal_quality_gate_agent import get_proposal_quality_gate_agent
from .executive_editor_agent import get_executive_editor_agent
from .similarity_validator_agent import get_similarity_validator_agent
# Narrative Control Layer Agents (NEW - P0)
from .proposal_narrative_architect_agent import get_proposal_narrative_architect
from .proposal_depth_scoring_agent import get_proposal_depth_scoring_agent
from .executive_confidence_gate_agent import get_executive_confidence_gate
# Client Context & Isolation Agents (CRITICAL - P0)
from .client_context_synthesis_agent import get_client_context_synthesis_agent
from .context_isolation_agent import get_context_isolation_agent

logger = logging.getLogger(__name__)


class OrchestratorAgent:
    """
    Main orchestrator that coordinates the multi-agent workflow.
    
    Enhanced Workflow with Narrative Control Layer:
    0. Narrative Architect → Establishes narrative foundation (FIRST - P0)
    1. Document Analyzer → Extracts structure and themes (enhanced with narrative)
    2. Question Extractor → Identifies questions
    3. Knowledge Base → Retrieves context
    4. Answer Generator → Creates draft answers (with narrative context)
    4.5. Answer Validator → Validates answers against knowledge
    4.6. Compliance Checker → Validates compliance claims
    5. Clarification Agent → Identifies questions needing clarification
    6. Quality Reviewer → Reviews and validates
    7. Depth Scoring → Scores content quality, triggers regeneration
    8. Executive Gate → Final CXO-perspective validation
    """
    
    # Workflow step definitions for progress tracking
    WORKFLOW_STEPS = [
        {'step': 0, 'id': 'narrative_architecture', 'name': 'Narrative Architecture', 'agent': 'ProposalNarrativeArchitectAgent', 'weight': 10},
        {'step': 1, 'id': 'document_analysis', 'name': 'Document Analysis', 'agent': 'DocumentAnalyzerAgent', 'weight': 10},
        {'step': 2, 'id': 'question_extraction', 'name': 'Question Extraction', 'agent': 'QuestionExtractorAgent', 'weight': 10},
        {'step': 3, 'id': 'knowledge_retrieval', 'name': 'Knowledge Retrieval', 'agent': 'KnowledgeBaseAgent', 'weight': 15},
        {'step': 4, 'id': 'answer_generation', 'name': 'Answer Generation', 'agent': 'AnswerGeneratorAgent', 'weight': 20},
        {'step': 5, 'id': 'answer_validation', 'name': 'Answer Validation', 'agent': 'AnswerValidatorAgent', 'weight': 10},
        {'step': 6, 'id': 'compliance_check', 'name': 'Compliance Check', 'agent': 'ComplianceCheckerAgent', 'weight': 5},
        {'step': 7, 'id': 'clarification', 'name': 'Clarification Analysis', 'agent': 'ClarificationAgent', 'weight': 5},
        {'step': 8, 'id': 'quality_review', 'name': 'Quality Review', 'agent': 'QualityReviewerAgent', 'weight': 5},
        {'step': 9, 'id': 'depth_scoring', 'name': 'Depth Scoring', 'agent': 'ProposalDepthScoringAgent', 'weight': 5},
        {'step': 10, 'id': 'executive_edit', 'name': 'Executive Editing', 'agent': 'ExecutiveEditorAgent', 'weight': 5},
        {'step': 11, 'id': 'similarity_validation', 'name': 'Similarity Validation', 'agent': 'SimilarityValidatorAgent', 'weight': 3},
        {'step': 12, 'id': 'executive_gate', 'name': 'Executive Confidence Gate', 'agent': 'ExecutiveConfidenceGateAgent', 'weight': 5},
        {'step': 13, 'id': 'quality_gate', 'name': 'Quality Gate', 'agent': 'ProposalQualityGateAgent', 'weight': 2},
    ]
    
    # Error recovery strategies
    ERROR_RECOVERY = {
        'narrative_architecture': {'fallback': 'use_default', 'critical': False},
        'document_analysis': {'fallback': 'skip', 'critical': True},
        'question_extraction': {'fallback': 'skip', 'critical': True},
        'knowledge_retrieval': {'fallback': 'continue_empty', 'critical': False},
        'answer_generation': {'fallback': 'partial', 'critical': True},
        'answer_validation': {'fallback': 'skip_validation', 'critical': False},
        'compliance_check': {'fallback': 'skip', 'critical': False},
        'clarification': {'fallback': 'skip', 'critical': False},
        'quality_review': {'fallback': 'skip', 'critical': False},
        'depth_scoring': {'fallback': 'skip', 'critical': False},
        'executive_edit': {'fallback': 'skip', 'critical': False},
        'similarity_validation': {'fallback': 'skip', 'critical': False},
        'executive_gate': {'fallback': 'pass_with_warning', 'critical': False},
        'quality_gate': {'fallback': 'pass_with_warning', 'critical': True},
    }
    
    # Regeneration settings
    DEPTH_SCORE_THRESHOLD = 4.0  # Sections below this score trigger regeneration
    MAX_REGENERATION_ATTEMPTS = 2  # Maximum times to regenerate a section

    
    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='default')
        self.name = "OrchestratorAgent"
        self.org_id = org_id
        
        # Initialize Client Context & Isolation Agents (CRITICAL - P0, run before all)
        self.client_context_agent = get_client_context_synthesis_agent(org_id=org_id)
        self.context_isolation_agent = get_context_isolation_agent(org_id=org_id)
        
        # Initialize Narrative Control Layer agents (P0 - run first)
        self.narrative_architect = get_proposal_narrative_architect(org_id=org_id)
        self.depth_scorer = get_proposal_depth_scoring_agent(org_id=org_id)
        self.executive_gate = get_executive_confidence_gate(org_id=org_id)
        
        # Initialize core processing agents with org_id for proper LLM config
        self.document_analyzer = get_document_analyzer_agent(org_id=org_id)
        self.question_extractor = get_question_extractor_agent(org_id=org_id)
        self.knowledge_base = get_knowledge_base_agent(org_id=org_id)
        self.answer_generator = get_answer_generator_agent(org_id=org_id)
        self.answer_validator = get_answer_validator_agent(org_id=org_id)
        self.compliance_checker = get_compliance_checker_agent(org_id=org_id)
        self.clarification_agent = get_clarification_agent(org_id=org_id)
        self.quality_reviewer = get_quality_reviewer_agent(org_id=org_id)
        
        # Cached context for use across all agents
        self._narrative_context = None
        self._client_context = None  # NEW: Client context (domain, forbidden refs)
    
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
            "narrative_context": None,
            "client_context": None,  # NEW: Domain, forbidden refs, success definition
            "questions": [],
            "answers": [],
            "depth_scores": {},
            "executive_gate": None,
            "stats": {},
            "agent_log": []
        }
        
        try:
            # Extract project data from options or build from document
            project_data = options.get('project_data', {
                'name': options.get('project_name', 'RFP Response'),
                'client_name': options.get('client_name', 'Client'),
                'description': document_text[:2000]  # First 2000 chars as description
            })
            
            # Step 0: Synthesize Client Context (CRITICAL - RUNS BEFORE ALL)
            session_state[SessionKeys.CURRENT_STEP] = "synthesizing_client_context"
            logger.info("Step 0: Synthesizing client context (CRITICAL)...")
            
            context_result = self.client_context_agent.synthesize_context(
                rfp_title=project_data.get('name', ''),
                client_name=project_data.get('client_name', ''),
                industry=options.get('industry', ''),
                description=project_data.get('description', document_text[:2000])
            )
            
            if context_result.get('success'):
                self._client_context = context_result.get('context', {})
                result["client_context"] = self._client_context
                result["steps_completed"].append("client_context_synthesis")
                session_state['client_context'] = self._client_context
                logger.info(f"Client context synthesized: domain={self._client_context.get('domain')}, forbidden_refs={len(self._client_context.get('forbidden_references', []))}")
            else:
                logger.warning("Client context synthesis failed - using defaults")
                self._client_context = {'domain': 'enterprise', 'forbidden_references': []}
                session_state['client_context'] = self._client_context
            
            # Step 0.5: Build Narrative Context (P0 - Uses client context)
            session_state[SessionKeys.CURRENT_STEP] = "building_narrative"
            logger.info("Step 0.5: Building narrative context (Narrative Architect)...")
            
            narrative_result = self.narrative_architect.build_narrative_context(
                project_data=project_data,
                rfp_content=document_text,
                vendor_profile=options.get('vendor_profile')
            )
            
            if narrative_result.get('success'):
                self._narrative_context = narrative_result.get('narrative_context', {})
                result["narrative_context"] = self._narrative_context
                result["steps_completed"].append("narrative_architecture")
                # Store narrative in session state for other agents
                session_state['narrative_context'] = self._narrative_context
                logger.info(f"Narrative established: {self._narrative_context.get('solution_thesis', 'N/A')[:100]}")
            else:
                logger.warning("Narrative architecture skipped - using defaults")
                self._narrative_context = self.narrative_architect.DEFAULT_NARRATIVE
                session_state['narrative_context'] = self._narrative_context

            
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
            
            # Step 6.5: Content Isolation Validation (CRITICAL - Prevent contamination)
            session_state[SessionKeys.CURRENT_STEP] = "validating_content_isolation"
            logger.info("Step 6.5: Validating content isolation (checking for cross-contamination)...")
            
            isolation_violations = []
            try:
                if self._client_context:
                    for i, answer in enumerate(result.get("answers", [])):
                        content = answer.get('content', answer.get('answer', ''))
                        if content:
                            validation = self.context_isolation_agent.validate_content(
                                content=content,
                                client_context=self._client_context
                            )
                            
                            if not validation.get('valid'):
                                isolation_violations.append({
                                    'index': i,
                                    'violations': validation.get('violations', []),
                                    'requires_regeneration': validation.get('requires_regeneration', False)
                                })
                    
                    result["isolation_violations"] = isolation_violations
                    result["steps_completed"].append("content_isolation_validation")
                    
                    if isolation_violations:
                        logger.warning(f"Found {len(isolation_violations)} sections with contamination issues")
                else:
                    result["steps_completed"].append("content_isolation_validation_skipped")
                    
            except Exception as isolation_err:
                logger.warning(f"Content isolation validation skipped: {isolation_err}")
                result["steps_completed"].append("content_isolation_validation_skipped")
            
            # Step 7: Score Content Depth (P0 - Quality Enforcement)
            session_state[SessionKeys.CURRENT_STEP] = "scoring_depth"
            logger.info("Step 7: Scoring content depth (Depth Scoring Agent)...")
            
            depth_scores = {}
            low_scoring_sections = []
            
            try:
                # Score each answer/section
                for i, answer in enumerate(result.get("answers", [])):
                    section_content = answer.get('content', answer.get('answer', ''))
                    section_title = answer.get('question', {}).get('text', f'Section {i+1}')[:100]
                    
                    if section_content:
                        score_result = self.depth_scorer.score_section(
                            section_title=section_title,
                            section_content=section_content,
                            narrative_context=self._narrative_context
                        )
                        
                        if score_result.get('success'):
                            scoring = score_result.get('scoring', {})
                            depth_scores[f"section_{i}"] = scoring
                            overall_score = scoring.get('overall_score', 0)
                            
                            if overall_score < self.DEPTH_SCORE_THRESHOLD:
                                low_scoring_sections.append({
                                    'index': i,
                                    'title': section_title,
                                    'score': overall_score,
                                    'issues': scoring.get('issues', [])
                                })
                
                result["depth_scores"] = depth_scores
                result["low_scoring_sections"] = low_scoring_sections
                result["steps_completed"].append("depth_scoring")
                
                # Step 7.5: Auto-Regeneration Loop for Low-Scoring Sections
                if low_scoring_sections:
                    logger.warning(f"Found {len(low_scoring_sections)} sections below quality threshold - starting regeneration")
                    result["regeneration_needed"] = True
                    
                    regeneration_results = []
                    for low_section in low_scoring_sections[:self.MAX_REGENERATION_ATTEMPTS]:
                        try:
                            idx = low_section['index']
                            original_answer = result["answers"][idx]
                            question = original_answer.get('question', {})
                            
                            # Add improvement hints based on issues
                            improvement_hints = []
                            for issue in low_section.get('issues', []):
                                improvement_hints.append(f"- {issue}")
                            
                            # Regenerate with context
                            logger.info(f"Regenerating section {idx}: {low_section['title'][:50]}...")
                            
                            regen_result = self.answer_generator.regenerate_answer(
                                question=question,
                                original_answer=original_answer.get('content', ''),
                                improvement_hints=improvement_hints,
                                narrative_context=self._narrative_context,
                                session_state=session_state
                            )
                            
                            if regen_result.get('success'):
                                new_content = regen_result.get('answer', original_answer.get('content', ''))
                                result["answers"][idx]['content'] = new_content
                                result["answers"][idx]['regenerated'] = True
                                regeneration_results.append({
                                    'index': idx,
                                    'success': True,
                                    'previous_score': low_section['score']
                                })
                            else:
                                regeneration_results.append({
                                    'index': idx,
                                    'success': False,
                                    'reason': 'regeneration_failed'
                                })
                                
                        except Exception as regen_err:
                            logger.warning(f"Regeneration failed for section {idx}: {regen_err}")
                            regeneration_results.append({
                                'index': idx,
                                'success': False,
                                'reason': str(regen_err)
                            })
                    
                    result["regeneration_results"] = regeneration_results
                    result["steps_completed"].append("auto_regeneration")
                else:
                    result["regeneration_needed"] = False
                    
            except Exception as depth_err:
                logger.warning(f"Depth scoring skipped: {depth_err}")
                result["steps_completed"].append("depth_scoring_skipped")
            
            # Step 8: Executive Confidence Gate (P0 - Final Gate)
            session_state[SessionKeys.CURRENT_STEP] = "executive_gate"
            logger.info("Step 8: Running Executive Confidence Gate...")
            
            try:
                # Build proposal summary for executive evaluation
                proposal_summary = self._build_proposal_summary(result, options)
                
                # Build sections list for evaluation
                sections_for_gate = [
                    {'title': a.get('question', {}).get('text', f'Section {i}')[:100],
                     'content': a.get('content', a.get('answer', ''))}
                    for i, a in enumerate(result.get("answers", []))
                ]
                
                gate_result = self.executive_gate.evaluate_proposal(
                    proposal_summary=proposal_summary,
                    executive_summary=self._extract_executive_summary(result.get("answers", [])),
                    sections=sections_for_gate,
                    narrative_context=self._narrative_context,
                    vendor_name=options.get('organization_name', 'Our Organization')
                )
                
                if gate_result.get('success'):
                    evaluation = gate_result.get('evaluation', {})
                    result["executive_gate"] = {
                        'executive_ready': evaluation.get('executive_ready', False),
                        'trust_score': evaluation.get('trust_score', 0),
                        'checklist': evaluation.get('checklist', {}),
                        'gaps': evaluation.get('gaps', []),
                        'executive_summary_rewrite_needed': evaluation.get('executive_summary_rewrite_needed', False)
                    }
                    result["steps_completed"].append("executive_gate")
                    
                    if not gate_result.get('executive_ready', False):
                        logger.warning(f"Proposal not executive-ready. Trust score: {gate_result.get('trust_score', 0)}")
                else:
                    result["steps_completed"].append("executive_gate_skipped")
                    
            except Exception as gate_err:
                logger.warning(f"Executive gate skipped: {gate_err}")
                result["steps_completed"].append("executive_gate_skipped")
            
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Orchestration error: {e}")
            result["error"] = str(e)
            session_state[SessionKeys.ERRORS].append(str(e))
        
        return self._finalize_result(result, session_state)
    
    def _build_proposal_summary(self, result: Dict, options: Dict) -> str:
        """Build a summary of the proposal for executive evaluation."""
        summary_parts = []
        
        # Add narrative context summary
        if self._narrative_context:
            summary_parts.append(f"Solution Thesis: {self._narrative_context.get('solution_thesis', 'N/A')}")
            summary_parts.append(f"Core Problem: {self._narrative_context.get('core_problem', 'N/A')}")
            
            value_pillars = self._narrative_context.get('value_pillars', [])
            if value_pillars:
                pillars = [p.get('pillar', '') for p in value_pillars[:3]]
                summary_parts.append(f"Value Pillars: {', '.join(pillars)}")
        
        # Add document analysis summary
        doc_analysis = result.get('document_analysis', {})
        if doc_analysis:
            summary_parts.append(f"Document Type: {doc_analysis.get('document_type', 'Unknown')}")
            themes = doc_analysis.get('themes', [])
            if themes:
                summary_parts.append(f"Key Themes: {', '.join(themes[:5])}")
        
        # Add answer count
        answer_count = len(result.get('answers', []))
        summary_parts.append(f"Total Responses: {answer_count}")
        
        return '\n'.join(summary_parts)
    
    def _extract_executive_summary(self, answers: List[Dict]) -> str:
        """Extract executive summary from answers if available."""
        for answer in answers:
            question = answer.get('question', {})
            question_text = question.get('text', '').lower()
            
            # Look for executive summary type content
            if any(term in question_text for term in ['executive summary', 'overview', 'introduction', 'summary']):
                return answer.get('content', answer.get('answer', ''))[:3000]
        
        # Fallback: use first answer
        if answers:
            return answers[0].get('content', answers[0].get('answer', ''))[:2000]
        
        return "No executive summary available."
    
    def _build_sections_overview(self, answers: List[Dict]) -> str:
        """Build an overview of all sections for executive gate."""
        sections = []
        
        for i, answer in enumerate(answers[:10]):  # Limit to first 10
            question = answer.get('question', {})
            question_text = question.get('text', f'Section {i+1}')[:100]
            content = answer.get('content', answer.get('answer', ''))
            word_count = len(content.split()) if content else 0
            
            sections.append(f"- {question_text}: {word_count} words")
        
        if len(answers) > 10:
            sections.append(f"- ... and {len(answers) - 10} more sections")
        
        return '\n'.join(sections)
    
    def get_narrative_context(self) -> Optional[Dict]:
        """Return the current narrative context."""
        return self._narrative_context
    
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


def get_orchestrator_agent(org_id: int = None) -> OrchestratorAgent:
    """Factory function to get the Orchestrator Agent."""
    return OrchestratorAgent(org_id=org_id)
