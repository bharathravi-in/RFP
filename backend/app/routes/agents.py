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
    else:
        org_id = data.get('org_id')
    
    if not document_text:
        return jsonify({"error": "No document text provided"}), 400
    
    options = data.get('options', {})
    
    try:
        orchestrator = get_orchestrator_agent()
        result = orchestrator.analyze_rfp(
            document_text=document_text,
            org_id=org_id,
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
    options = data.get('options', {})
    
    try:
        orchestrator = get_orchestrator_agent()
        result = orchestrator.generate_answers_for_questions(
            questions=questions,
            org_id=org_id,
            options=options
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Answer generation failed: {e}")
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
            "OrchestratorAgent"
        ]
    })
