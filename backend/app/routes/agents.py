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
            
            # Auto-trigger parsing if no extracted text
            if not document.extracted_text:
                logger.info(f"Document {document_id} has no extracted text, triggering parse...")
                try:
                    from app.routes.documents import _parse_document_internal
                    parse_result = _parse_document_internal(document)
                    if 'error' in parse_result:
                        return jsonify({"error": f"Failed to parse document: {parse_result['error']}"}), 400
                    # Refresh document after parsing
                    from app.extensions import db
                    db.session.refresh(document)
                except Exception as e:
                    logger.error(f"Failed to parse document {document_id}: {e}")
                    return jsonify({"error": f"Document parsing failed: {str(e)}"}), 400
            
            if not document.extracted_text:
                return jsonify({"error": "Document has no extracted text after parsing"}), 400
            
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


# ===============================
# Pricing Calculator Routes (NEW)
# ===============================

@agents_bp.route('/calculate-pricing', methods=['POST'])
def calculate_pricing():
    """
    Calculate pricing for a proposal.
    
    Request body:
    {
        "project_id": int,  // OR provide project_data directly
        "project_data": {
            "name": "Project Name",
            "client_name": "Client",
            "description": "..."
        },
        "sections": [{"title": "...", "content": "..."}],
        "complexity": "low|medium|high|very_high",
        "duration_weeks": int (optional)
    }
    
    Returns pricing breakdown with effort and cost estimates.
    """
    from app.agents import get_pricing_calculator_agent
    from app.models import Project, Organization, RFPSection, Question
    
    data = request.get_json() or {}
    
    project_id = data.get('project_id')
    project_data = data.get('project_data', {})
    sections_data = data.get('sections', [])
    questions = data.get('questions', [])
    organization = None
    
    # If project_id provided, load project data
    if project_id:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        
        # Try to get currency from project's knowledge profiles
        profile_currency = None
        if hasattr(project, 'knowledge_profiles') and project.knowledge_profiles:
            for profile in project.knowledge_profiles:
                if profile.currencies and len(profile.currencies) > 0:
                    # Use the first currency from the first profile that has currencies
                    profile_currency = profile.currencies[0]
                    break
        
        project_data = {
            'name': project.name,
            'client_name': project.client_name,
            'description': project.description,
            'currency': project.currency or profile_currency,  # Include project currency or profile currency
        }
        
        # Get sections
        sections = RFPSection.query.filter_by(project_id=project_id).all()
        sections_data = [{'title': s.title, 'content': s.content or ''} for s in sections]
        
        # Get questions
        questions_objs = Question.query.filter_by(project_id=project_id).all()
        questions = [{'id': q.id, 'text': q.text} for q in questions_objs]
        
        # Get organization
        if project.organization_id:
            organization = Organization.query.get(project.organization_id)
            org_id = project.organization_id
        else:
            org_id = data.get('org_id')
    else:
        org_id = data.get('org_id')
        if org_id:
            organization = Organization.query.get(org_id)
    
    # Get currency - prefer project currency, then org settings, then default
    currency = project_data.get('currency') or data.get('currency') or 'USD'
    
    logger.info(f"Calculating pricing with currency: {currency}")
    
    try:
        agent = get_pricing_calculator_agent(org_id=org_id)
        result = agent.calculate_pricing(
            project_data=project_data,
            sections=sections_data,
            questions=questions,
            organization=organization,
            complexity=data.get('complexity', 'medium'),
            duration_weeks=data.get('duration_weeks'),
            currency=currency  # Pass currency to agent
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Pricing calculation failed: {e}")
        return jsonify({"error": str(e)}), 500




@agents_bp.route('/estimate-effort', methods=['POST'])
def estimate_effort():
    """
    Quick effort estimation from requirements list.
    
    Request body:
    {
        "requirements": ["Requirement 1", "Requirement 2"],
        "complexity": "low|medium|high|very_high"
    }
    
    Returns quick effort and cost estimate.
    """
    from app.agents import get_pricing_calculator_agent
    
    data = request.get_json() or {}
    
    requirements = data.get('requirements', [])
    if not requirements:
        return jsonify({"error": "No requirements provided"}), 400
    
    complexity = data.get('complexity', 'medium')
    org_id = data.get('org_id')
    
    try:
        agent = get_pricing_calculator_agent(org_id=org_id)
        result = agent.estimate_effort(
            requirements=requirements,
            complexity=complexity
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Effort estimation failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Legal Review Routes (NEW)
# ===============================

@agents_bp.route('/legal-review', methods=['POST'])
def legal_review():
    """
    Perform legal review of proposal sections.
    
    Request body:
    {
        "project_id": int,  // OR provide sections directly
        "sections": [{"title": "...", "content": "..."}],
        "project_data": {"name": "...", "client_name": "..."},
        "check_mode": "full|quick|compliance_only"
    }
    
    Returns legal review findings and recommendations.
    """
    from app.agents import get_legal_review_agent
    from app.models import Project, Organization, RFPSection
    
    data = request.get_json() or {}
    
    project_id = data.get('project_id')
    sections_data = data.get('sections', [])
    project_data = data.get('project_data', {})
    vendor_profile = data.get('vendor_profile', {})
    
    # If project_id provided, load project data
    if project_id:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        
        project_data = {
            'name': project.name,
            'client_name': project.client_name,
        }
        
        # Get sections
        sections = RFPSection.query.filter_by(project_id=project_id).all()
        sections_data = [{'title': s.title, 'content': s.content or ''} for s in sections]
        
        # Get vendor profile from organization
        if project.organization_id:
            org = Organization.query.get(project.organization_id)
            if org and org.settings:
                vendor_profile = org.settings.get('vendor_profile', {})
            org_id = project.organization_id
        else:
            org_id = data.get('org_id')
    else:
        org_id = data.get('org_id')
    
    if not sections_data:
        return jsonify({"error": "No sections to review"}), 400
    
    try:
        agent = get_legal_review_agent(org_id=org_id)
        result = agent.review_proposal(
            sections=sections_data,
            project_data=project_data,
            vendor_profile=vendor_profile,
            check_mode=data.get('check_mode', 'full')
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Legal review failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/legal-quick-check', methods=['POST'])
def legal_quick_check():
    """
    Quick legal check on a single piece of content.
    
    Request body:
    {
        "content": "Text to check for legal risks"
    }
    
    Returns quick risk assessment.
    """
    from app.agents import get_legal_review_agent
    
    data = request.get_json() or {}
    
    content = data.get('content', '')
    if not content:
        return jsonify({"error": "No content provided"}), 400
    
    org_id = data.get('org_id')
    
    try:
        agent = get_legal_review_agent(org_id=org_id)
        result = agent.quick_check(content=content)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Legal quick check failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Win Theme Routes (NEW)
# ===============================

@agents_bp.route('/generate-win-themes', methods=['POST'])
def generate_win_themes():
    """
    Generate win themes and differentiators for a proposal.
    
    Request body:
    {
        "project_id": int,  // OR provide project_data directly
        "project_data": {"name": "...", "client_name": "...", "description": "..."},
        "rfp_requirements": ["Requirement 1", "Requirement 2"],
        "evaluation_criteria": ["Criteria 1", "Criteria 2"]
    }
    
    Returns win themes, differentiators, and value propositions.
    """
    from app.agents import get_win_theme_agent
    from app.models import Project, Organization
    
    data = request.get_json() or {}
    
    project_id = data.get('project_id')
    project_data = data.get('project_data', {})
    vendor_profile = data.get('vendor_profile', {})
    
    # If project_id provided, load project data
    if project_id:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        
        project_data = {
            'name': project.name,
            'client_name': project.client_name,
            'description': project.description,
        }
        
        # Get vendor profile from organization
        if project.organization_id:
            org = Organization.query.get(project.organization_id)
            if org and org.settings:
                vendor_profile = org.settings.get('vendor_profile', {})
            org_id = project.organization_id
        else:
            org_id = data.get('org_id')
    else:
        org_id = data.get('org_id')
    
    try:
        agent = get_win_theme_agent(org_id=org_id)
        result = agent.generate_win_themes(
            project_data=project_data,
            rfp_requirements=data.get('rfp_requirements', []),
            vendor_profile=vendor_profile,
            evaluation_criteria=data.get('evaluation_criteria'),
            competitor_info=data.get('competitor_info')
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Win theme generation failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/apply-themes-to-section', methods=['POST'])
def apply_themes_to_section():
    """
    Apply win themes to enhance a section.
    
    Request body:
    {
        "section_content": "Current section content",
        "section_name": "Executive Summary",
        "win_themes": [{"theme_title": "...", "sections_to_apply": [...]}]
    }
    
    Returns enhanced section content.
    """
    from app.agents import get_win_theme_agent
    
    data = request.get_json() or {}
    
    section_content = data.get('section_content', '')
    section_name = data.get('section_name', '')
    win_themes = data.get('win_themes', [])
    
    if not section_content or not win_themes:
        return jsonify({"error": "section_content and win_themes required"}), 400
    
    org_id = data.get('org_id')
    
    try:
        agent = get_win_theme_agent(org_id=org_id)
        enhanced = agent.apply_themes_to_section(
            section_content=section_content,
            win_themes=win_themes,
            section_name=section_name
        )
        return jsonify({"enhanced_content": enhanced})
    except Exception as e:
        logger.error(f"Theme application failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Competitive Analysis Routes (NEW)
# ===============================

@agents_bp.route('/competitive-analysis', methods=['POST'])
def competitive_analysis():
    """
    Perform competitive analysis for a proposal.
    
    Request body:
    {
        "project_id": int,  // OR provide project_data directly
        "project_data": {"name": "...", "client_name": "..."},
        "rfp_requirements": ["Requirement 1"],
        "known_competitors": ["Competitor A"],
        "industry": "Technology"
    }
    
    Returns competitive landscape, strategies, and counter-objections.
    """
    from app.agents import get_competitive_analysis_agent
    from app.models import Project, Organization
    
    data = request.get_json() or {}
    
    project_id = data.get('project_id')
    project_data = data.get('project_data', {})
    vendor_profile = data.get('vendor_profile', {})
    
    # If project_id provided, load project data
    if project_id:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        
        project_data = {
            'name': project.name,
            'client_name': project.client_name,
            'description': project.description,
        }
        
        # Get vendor profile from organization
        if project.organization_id:
            org = Organization.query.get(project.organization_id)
            if org and org.settings:
                vendor_profile = org.settings.get('vendor_profile', {})
            org_id = project.organization_id
        else:
            org_id = data.get('org_id')
    else:
        org_id = data.get('org_id')
    
    try:
        agent = get_competitive_analysis_agent(org_id=org_id)
        result = agent.analyze_competition(
            project_data=project_data,
            vendor_profile=vendor_profile,
            rfp_requirements=data.get('rfp_requirements', []),
            known_competitors=data.get('known_competitors'),
            industry=data.get('industry')
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Competitive analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


@agents_bp.route('/counter-objections', methods=['POST'])
def generate_counter_objections():
    """
    Generate responses to specific objections.
    
    Request body:
    {
        "objections": ["Objection 1", "Objection 2"],
        "vendor_profile": {...}
    }
    
    Returns objection-response pairs.
    """
    from app.agents import get_competitive_analysis_agent
    
    data = request.get_json() or {}
    
    objections = data.get('objections', [])
    if not objections:
        return jsonify({"error": "No objections provided"}), 400
    
    org_id = data.get('org_id')
    
    try:
        agent = get_competitive_analysis_agent(org_id=org_id)
        result = agent.generate_counter_objections(
            objections=objections,
            vendor_profile=data.get('vendor_profile')
        )
        return jsonify({"counter_objections": result})
    except Exception as e:
        logger.error(f"Counter objection generation failed: {e}")
        return jsonify({"error": str(e)}), 500


# ===============================
# Strategy Persistence Routes
# ===============================

@agents_bp.route('/strategy/<int:project_id>', methods=['GET'])
def get_project_strategy(project_id: int):
    """
    Get saved strategy data for a project.
    
    Returns all saved strategy insights (win themes, competitive analysis, pricing, legal review).
    """
    from app.models import ProjectStrategy, Project
    
    # Verify project exists
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    # Get or create strategy record
    strategy = ProjectStrategy.query.filter_by(project_id=project_id).first()
    
    if strategy:
        return jsonify({
            "success": True,
            "strategy": strategy.to_dict()
        })
    else:
        # No strategy data yet
        return jsonify({
            "success": True,
            "strategy": None
        })


@agents_bp.route('/strategy/<int:project_id>/win-themes', methods=['POST'])
def save_win_themes(project_id: int):
    """
    Save win themes data for a project.
    """
    from app.models import ProjectStrategy, Project
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    data = request.get_json() or {}
    
    strategy = ProjectStrategy.get_or_create(project_id)
    strategy.update_win_themes(data)
    
    return jsonify({
        "success": True,
        "message": "Win themes saved"
    })


@agents_bp.route('/strategy/<int:project_id>/competitive-analysis', methods=['POST'])
def save_competitive_analysis(project_id: int):
    """
    Save competitive analysis data for a project.
    """
    from app.models import ProjectStrategy, Project
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    data = request.get_json() or {}
    
    strategy = ProjectStrategy.get_or_create(project_id)
    strategy.update_competitive_analysis(data)
    
    return jsonify({
        "success": True,
        "message": "Competitive analysis saved"
    })


@agents_bp.route('/strategy/<int:project_id>/pricing', methods=['POST'])
def save_pricing(project_id: int):
    """
    Save pricing data for a project.
    """
    from app.models import ProjectStrategy, Project
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    data = request.get_json() or {}
    
    strategy = ProjectStrategy.get_or_create(project_id)
    strategy.update_pricing(data)
    
    return jsonify({
        "success": True,
        "message": "Pricing saved"
    })


@agents_bp.route('/strategy/<int:project_id>/legal-review', methods=['POST'])
def save_legal_review(project_id: int):
    """
    Save legal review data for a project.
    """
    from app.models import ProjectStrategy, Project
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    data = request.get_json() or {}
    
    strategy = ProjectStrategy.get_or_create(project_id)
    strategy.update_legal_review(data)
    
    return jsonify({
        "success": True,
        "message": "Legal review saved"
    })
