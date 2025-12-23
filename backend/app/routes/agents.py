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
            "QualityReviewerAgent",
            "OrchestratorAgent",
            "DiagramGeneratorAgent"
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

