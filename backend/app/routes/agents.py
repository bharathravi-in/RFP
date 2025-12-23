"""
Agent API Routes

Provides REST API endpoints for the multi-agent RFP analysis system.
"""
from flask import Blueprint, request, jsonify, current_app
import logging

from app.agents import (
    get_orchestrator_agent,
    get_document_analyzer_agent,
    get_question_extractor_agent,
    get_answer_generator_agent
)
from app.models import Document

logger = logging.getLogger(__name__)

agents_bp = Blueprint('agents', __name__, url_prefix='/api/agents')


@agents_bp.route('/analyze-rfp', methods=['POST'])
def analyze_rfp():
    """
    Run complete RFP analysis workflow.
    
    Request body:
    {
        "document_id": int,  // OR
        "document_text": string,
        "org_id": int (optional),
        "options": {
            "tone": "professional|formal|friendly",
            "length": "short|medium|long"
        }
    }
    
    Returns complete analysis with questions and answers.
    """
    data = request.get_json() or {}
    
    # Get document text
    document_text = data.get('document_text')
    document_id = data.get('document_id')
    
    if not document_text and document_id:
        document = Document.query.get(document_id)
        if not document:
            return jsonify({"error": "Document not found"}), 404
        if not document.extracted_text:
            return jsonify({"error": "Document has no extracted text"}), 400
        document_text = document.extracted_text
        org_id = data.get('org_id') or (document.project.organization_id if document.project else None)
        project_id = data.get('project_id') or (document.project_id if document.project_id else None)  # NEW
    else:
        org_id = data.get('org_id')
        project_id = data.get('project_id')  # NEW
    
    if not document_text:
        return jsonify({"error": "No document text provided"}), 400
    
    options = data.get('options', {})
    
    try:
        orchestrator = get_orchestrator_agent()
        result = orchestrator.analyze_rfp(
            document_text=document_text,
            org_id=org_id,
            project_id=project_id,  # NEW
            options=options
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"RFP analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/analyze-document', methods=['POST'])
def analyze_document():
    """
    Analyze document structure only.
    
    Request body:
    {
        "document_id": int, // OR
        "document_text": string
    }
    """
    data = request.get_json() or {}
    
    document_text = data.get('document_text')
    if not document_text and data.get('document_id'):
        document = Document.query.get(data['document_id'])
        if document and document.extracted_text:
            document_text = document.extracted_text
    
    if not document_text:
        return jsonify({"error": "No document text provided"}), 400
    
    try:
        orchestrator = get_orchestrator_agent()
        result = orchestrator.analyze_document_only(document_text)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/extract-questions', methods=['POST'])
def extract_questions():
    """
    Extract questions from a document.
    
    Request body:
    {
        "document_id": int, // OR
        "document_text": string
    }
    """
    data = request.get_json() or {}
    
    document_text = data.get('document_text')
    if not document_text and data.get('document_id'):
        document = Document.query.get(data['document_id'])
        if document and document.extracted_text:
            document_text = document.extracted_text
    
    if not document_text:
        return jsonify({"error": "No document text provided"}), 400
    
    try:
        orchestrator = get_orchestrator_agent()
        result = orchestrator.extract_questions_only(document_text)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Question extraction failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/generate-answers', methods=['POST'])
def generate_answers():
    """
    Generate answers for questions.
    
    Request body:
    {
        "questions": [
            {"id": 1, "text": "...", "category": "..."}
        ],
        "org_id": int (optional),
        "options": {
            "tone": "professional|formal|friendly",
            "length": "short|medium|long"
        }
    }
    """
    data = request.get_json() or {}
    
    questions = data.get('questions', [])
    if not questions:
        return jsonify({"error": "No questions provided"}), 400
    
    org_id = data.get('org_id')
    project_id = data.get('project_id')  # NEW
    options = data.get('options', {})
    
    try:
        orchestrator = get_orchestrator_agent()
        result = orchestrator.generate_answers_for_questions(
            questions=questions,
            org_id=org_id,
            project_id=project_id,  # NEW
            options=options
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Answer generation failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/analyze-rfp-async', methods=['POST'])
def analyze_rfp_async():
    """
    Start async RFP analysis workflow (returns job ID immediately).
    
    Request body: Same as /analyze-rfp
    
    Returns:
        {"job_id": "uuid", "status_url": "/api/agents/job-status/<job_id>"}
    """
    try:
        from app.extensions import celery
        data = request.get_json() or {}
        
        # Get document text
        document_text = data.get('document_text')
        document_id = data.get('document_id')
        
        if not document_text and document_id:
            document = Document.query.get(document_id)
            if not document:
                return jsonify({"error": "Document not found"}), 404
            if not document.extracted_text:
                return jsonify({"error": "Document has no extracted text"}), 400
            document_text = document.extracted_text
            org_id = data.get('org_id') or (document.project.organization_id if document.project else None)
            project_id = data.get('project_id') or (document.project_id if document.project_id else None)
        else:
            org_id = data.get('org_id')
            project_id = data.get('project_id')
        
        if not document_text:
            return jsonify({"error": "No document text provided"}), 400
        
        options = data.get('options', {})
        
        # Submit async task
        task = celery.send_task(
            'agents.analyze_rfp_async',
            args=[document_text],
            kwargs={
                'org_id': org_id,
                'project_id': project_id,
                'options': options
            }
        )
        
        return jsonify({
            "job_id": task.id,
            "status_url": f"/api/agents/job-status/{task.id}",
            "status": "PENDING"
        }), 202
        
    except Exception as e:
        logger.error(f"Failed to start async RFP analysis: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/job-status/<job_id>', methods=['GET'])
def job_status(job_id):
    """
    Get status of async job.
    
    Returns:
        {
            "job_id": "uuid",
            "status": "PENDING|PROGRESS|SUCCESS|FAILURE",
            "result": {...},  // if SUCCESS
            "error": "...",   // if FAILURE
            "progress": {...}  // if PROGRESS
        }
    """
    try:
        from app.extensions import celery
        from celery.result import AsyncResult
        
        task = AsyncResult(job_id, app=celery)
        
        response = {
            "job_id": job_id,
            "status": task.state
        }
        
        if task.state == 'PENDING':
            response['message'] = 'Task is queued'
        elif task.state == 'PROGRESS':
            response['progress'] = task.info
        elif task.state == 'SUCCESS':
            response['result'] = task.result
        elif task.state == 'FAILURE':
            response['error'] = str(task.info)
        else:
            response['info'] = str(task.info)
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/cancel-job/<job_id>', methods=['POST'])
def cancel_job(job_id):
    """
    Cancel a running async job.
    
    Returns:
        {"job_id": "uuid", "status": "CANCELLED"}
    """
    try:
        from app.extensions import celery
        from celery.result import AsyncResult
        
        task = AsyncResult(job_id, app=celery)
        task.revoke(terminate=True)
        
        return jsonify({
            "job_id": job_id,
            "status": "CANCELLED",
            "message": "Task cancellation requested"
        })
        
    except Exception as e:
        logger.error(f"Failed to cancel job: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/health', methods=['GET'])
def health_check():
    """Check agent system health and configuration."""
    from app.agents import get_agent_config
    
    config = get_agent_config()
    
    return jsonify({
        "status": "ok",
        "adk_enabled": config.is_adk_enabled,
        "api_configured": bool(config.api_key),
        "model": config.model_name,
        "agents": [
            "DocumentAnalyzerAgent",
            "QuestionExtractorAgent",
            "KnowledgeBaseAgent",
            "AnswerGeneratorAgent",
            "AnswerValidatorAgent",
            "ComplianceCheckerAgent",
            "FeedbackLearningAgent",
            "SectionMapperAgent",
            "QualityReviewerAgent",
            "ClarificationAgent",
            "OrchestratorAgent",
            "DiagramGeneratorAgent"
        ],
        "services": [
            "AgentMetricsService"
        ]
    })


# ===============================
# Diagram Generation Routes
# ===============================

@agents_bp.route('/diagram-types', methods=['GET'])
def get_diagram_types():
    """
    Get available diagram types.
    
    Returns:
        List of diagram types with metadata
    """
    from app.agents import get_diagram_generator_agent
    
    agent = get_diagram_generator_agent()
    return jsonify({
        "diagram_types": agent.get_available_types()
    })


@agents_bp.route('/generate-diagram', methods=['POST'])
def generate_diagram():
    """
    Generate a Mermaid.js diagram from RFP document.
    
    Request body:
    {
        "document_id": int,  // OR
        "document_text": string,
        "diagram_type": string,  // "architecture", "flowchart", "sequence", "timeline", "er", "mindmap"
        "project_id": int (optional)
    }
    
    Returns diagram with mermaid_code and metadata.
    """
    from app.agents import get_diagram_generator_agent
    
    data = request.get_json() or {}
    
    # Get document text
    document_text = data.get('document_text')
    document_id = data.get('document_id')
    
    if not document_text and document_id:
        document = Document.query.get(document_id)
        if not document:
            return jsonify({"error": "Document not found"}), 404
        if not document.extracted_text:
            return jsonify({"error": "Document has no extracted text"}), 400
        document_text = document.extracted_text
        org_id = document.project.organization_id if document.project else None
    else:
        org_id = data.get('org_id')
    
    if not document_text:
        return jsonify({"error": "No document text provided"}), 400
    
    diagram_type = data.get('diagram_type', 'architecture')
    
    try:
        agent = get_diagram_generator_agent(org_id=org_id)
        result = agent.generate_diagram(
            document_text=document_text,
            diagram_type=diagram_type
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Diagram generation failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/generate-all-diagrams', methods=['POST'])
def generate_all_diagrams():
    """
    Generate multiple diagram types from RFP document.
    
    Request body:
    {
        "document_id": int,  // OR
        "document_text": string,
        "diagram_types": ["architecture", "flowchart", "timeline"]  // optional, defaults to these 3
    }
    
    Returns list of generated diagrams.
    """
    from app.agents import get_diagram_generator_agent
    
    data = request.get_json() or {}
    
    # Get document text
    document_text = data.get('document_text')
    document_id = data.get('document_id')
    
    if not document_text and document_id:
        document = Document.query.get(document_id)
        if not document:
            return jsonify({"error": "Document not found"}), 404
        if not document.extracted_text:
            return jsonify({"error": "Document has no extracted text"}), 400
        document_text = document.extracted_text
        org_id = document.project.organization_id if document.project else None
    else:
        org_id = data.get('org_id')
    
    if not document_text:
        return jsonify({"error": "No document text provided"}), 400
    
    diagram_types = data.get('diagram_types')
    
    try:
        agent = get_diagram_generator_agent(org_id=org_id)
        result = agent.generate_all_diagrams(
            document_text=document_text,
            diagram_types=diagram_types
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Diagram generation failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Feedback Learning Routes (NEW)
# ===============================

@agents_bp.route('/feedback/analyze-edit', methods=['POST'])
def analyze_feedback_edit():
    """
    Analyze user edits to learn patterns for future improvement.
    
    Request body:
    {
        "original_answer": string,
        "edited_answer": string,
        "question_text": string,
        "category": string (optional),
        "question_id": int (optional),
        "org_id": int (optional)
    }
    """
    from app.agents import get_feedback_learning_agent
    
    data = request.get_json() or {}
    
    original = data.get('original_answer')
    edited = data.get('edited_answer')
    question = data.get('question_text')
    
    if not original or not edited or not question:
        return jsonify({"error": "original_answer, edited_answer, and question_text are required"}), 400
    
    org_id = data.get('org_id')
    
    try:
        agent = get_feedback_learning_agent(org_id=org_id)
        result = agent.analyze_edit(
            original_answer=original,
            edited_answer=edited,
            question_text=question,
            category=data.get('category', 'general'),
            question_id=data.get('question_id')
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Feedback analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/feedback/learned-context', methods=['GET'])
def get_learned_context():
    """
    Get learned patterns for a category.
    
    Query params:
        category: string (optional)
        limit: int (default 5)
        org_id: int (optional)
    """
    from app.agents import get_feedback_learning_agent
    
    category = request.args.get('category')
    limit = int(request.args.get('limit', 5))
    org_id = request.args.get('org_id', type=int)
    
    try:
        agent = get_feedback_learning_agent(org_id=org_id)
        result = agent.get_learned_context(category=category, limit=limit)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get learned context failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Section Mapping Routes (NEW)
# ===============================

@agents_bp.route('/sections/map-questions', methods=['POST'])
def map_questions_to_sections():
    """
    Map questions to proposal sections.
    
    Request body:
    {
        "questions": [{"id": 1, "text": "...", "category": "..."}],
        "org_id": int (optional),
        "custom_sections": {} (optional)
    }
    """
    from app.agents import get_section_mapper_agent
    
    data = request.get_json() or {}
    
    questions = data.get('questions', [])
    if not questions:
        return jsonify({"error": "No questions provided"}), 400
    
    org_id = data.get('org_id')
    
    try:
        agent = get_section_mapper_agent(org_id=org_id)
        result = agent.map_questions(
            questions=questions,
            custom_sections=data.get('custom_sections')
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Section mapping failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/sections/available', methods=['GET'])
def get_available_sections():
    """Get list of available proposal sections."""
    from app.agents import get_section_mapper_agent
    
    org_id = request.args.get('org_id', type=int)
    
    try:
        agent = get_section_mapper_agent(org_id=org_id)
        sections = agent.get_available_sections()
        return jsonify({"sections": sections})
    except Exception as e:
        logger.error(f"Get sections failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Metrics & Dashboard Routes (NEW)
# ===============================

@agents_bp.route('/metrics/dashboard', methods=['GET'])
def get_metrics_dashboard():
    """
    Get agent performance dashboard data.
    
    Query params:
        org_id: int (optional)
    """
    from app.agents import get_metrics_service
    
    org_id = request.args.get('org_id', type=int)
    
    try:
        service = get_metrics_service(org_id=org_id)
        dashboard = service.get_performance_dashboard()
        return jsonify(dashboard)
    except Exception as e:
        logger.error(f"Get dashboard failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/metrics/agent/<agent_name>', methods=['GET'])
def get_agent_metrics(agent_name):
    """
    Get metrics for a specific agent.
    
    Path params:
        agent_name: string
    Query params:
        hours_back: int (default 24)
    """
    from app.agents import get_metrics_service
    
    hours_back = int(request.args.get('hours_back', 24))
    
    try:
        service = get_metrics_service()
        result = service.get_agent_summary(agent_name=agent_name, hours_back=hours_back)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get agent metrics failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/experiments', methods=['POST'])
def create_experiment():
    """
    Create an A/B experiment for prompt testing.
    
    Request body:
    {
        "experiment_id": string,
        "agent_name": string,
        "control_version": string,
        "treatment_version": string,
        "traffic_split": float (optional, default 0.5)
    }
    """
    from app.agents import get_metrics_service
    
    data = request.get_json() or {}
    
    required = ['experiment_id', 'agent_name', 'control_version', 'treatment_version']
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    try:
        service = get_metrics_service()
        result = service.create_experiment(
            experiment_id=data['experiment_id'],
            agent_name=data['agent_name'],
            control_version=data['control_version'],
            treatment_version=data['treatment_version'],
            traffic_split=data.get('traffic_split', 0.5)
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Create experiment failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/experiments/<experiment_id>', methods=['GET'])
def get_experiment_results(experiment_id):
    """Get results for an A/B experiment."""
    from app.agents import get_metrics_service
    
    try:
        service = get_metrics_service()
        result = service.get_experiment_results(experiment_id)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get experiment results failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Multi-Document Analysis (NEW)
# ===============================

@agents_bp.route('/analyze-multiple-documents', methods=['POST'])
def analyze_multiple_documents():
    """
    Analyze multiple RFP documents together.
    
    Request body:
    {
        "documents": [
            {"id": 1, "name": "Main RFP", "text": "..."},
            {"id": 2, "name": "Appendix A", "text": "..."}
        ]
    }
    """
    from app.agents import get_document_analyzer_agent
    
    data = request.get_json() or {}
    documents = data.get('documents', [])
    
    if not documents:
        return jsonify({"error": "No documents provided"}), 400
    
    org_id = data.get('org_id')
    
    try:
        agent = get_document_analyzer_agent(org_id=org_id)
        result = agent.analyze_multiple(documents=documents)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Multi-document analysis failed: {e}")
        return jsonify({"error": str(e)}), 500
