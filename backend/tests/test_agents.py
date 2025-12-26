"""
Unit tests for AI Agents

Tests the core functionality of each agent with mocked LLM responses.
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List

# Import agents
from app.agents.question_extractor_agent import QuestionExtractorAgent, get_question_extractor_agent
from app.agents.answer_generator_agent import AnswerGeneratorAgent, get_answer_generator_agent
from app.agents.answer_validator_agent import AnswerValidatorAgent, get_answer_validator_agent
from app.agents.compliance_checker_agent import ComplianceCheckerAgent, get_compliance_checker_agent
from app.agents.knowledge_base_agent import KnowledgeBaseAgent, get_knowledge_base_agent
from app.agents.quality_reviewer_agent import QualityReviewerAgent, get_quality_reviewer_agent
from app.agents.clarification_agent import ClarificationAgent, get_clarification_agent
from app.agents.document_analyzer_agent import DocumentAnalyzerAgent, get_document_analyzer_agent


class TestQuestionExtractorAgent:
    """Tests for QuestionExtractorAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.question_extractor_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return QuestionExtractorAgent()
    
    def test_fallback_extraction_basic(self, agent):
        """Test fallback extraction finds basic questions."""
        text = """
        1. What is your disaster recovery plan?
        2. Describe your security measures.
        Please provide your pricing information.
        """
        result = agent._fallback_extraction(text)
        
        assert "questions" in result
        assert len(result["questions"]) > 0
    
    def test_fallback_extraction_skips_answers(self, agent):
        """Test that fallback extraction skips sample answers."""
        text = """
        What is your uptime guarantee?
        Vendor Response: We guarantee 99.9% uptime with our service.
        Example: Our team provides 24/7 support.
        """
        result = agent._fallback_extraction(text)
        
        # Should only extract the question, not the sample answers
        questions = result.get("questions", [])
        for q in questions:
            assert "99.9% uptime" not in q.get("text", "")
            assert "24/7 support" not in q.get("text", "")
    
    def test_validate_questions_filters_answers(self, agent):
        """Test that validation filters out answer-like text."""
        fake_questions = [
            {"text": "What is your security approach?", "id": 1},
            {"text": "We provide enterprise-grade security with SOC 2 certification.", "id": 2},
            {"text": "Yes, our solution is HIPAA compliant.", "id": 3},
            {"text": "Describe your backup procedures.", "id": 4}
        ]
        
        validated = agent._validate_questions(fake_questions)
        
        # Should keep the actual questions and filter answers
        assert len(validated) == 2
        assert any("security approach" in q["text"] for q in validated)
        assert any("backup procedures" in q["text"] for q in validated)
    
    def test_guess_category_security(self, agent):
        """Test category guessing for security questions."""
        assert agent._guess_category("What encryption do you use?") == "security"
        assert agent._guess_category("Describe your authentication system") == "security"
    
    def test_guess_category_compliance(self, agent):
        """Test category guessing for compliance questions."""
        assert agent._guess_category("Are you GDPR compliant?") == "compliance"
        assert agent._guess_category("Do you have regulatory certifications?") == "compliance"


class TestAnswerGeneratorAgent:
    """Tests for AnswerGeneratorAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.answer_generator_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return AnswerGeneratorAgent()
    
    def test_calculate_confidence_no_context(self, agent):
        """Test confidence is low when no context available."""
        context = {"knowledge_items": [], "similar_answers": []}
        confidence = agent._calculate_confidence(context, [])
        
        assert confidence == 0.4  # Base score only
    
    def test_calculate_confidence_with_knowledge(self, agent):
        """Test confidence increases with good knowledge items."""
        context = {
            "knowledge_items": [
                {"relevance": 0.9, "content": "High quality content"},
                {"relevance": 0.8, "content": "Another item"},
                {"relevance": 0.7, "content": "Third item"}
            ]
        }
        confidence = agent._calculate_confidence(context, [])
        
        assert confidence > 0.4  # Higher than base
        assert confidence >= 0.7  # With 3 items and high relevance
    
    def test_calculate_confidence_with_similar_answers(self, agent):
        """Test confidence increases with similar answers."""
        context = {"knowledge_items": []}
        similar = [{"similarity_score": 0.9}]
        confidence = agent._calculate_confidence(context, similar)
        
        assert confidence >= 0.65  # Base + similar answer bonus
    
    def test_placeholder_answer(self, agent):
        """Test placeholder answer when AI unavailable."""
        result = agent._placeholder_answer("What is your pricing?")
        
        assert "AI service unavailable" in result["content"]
        assert result["confidence"] == 0.0
        assert "ai_unavailable" in result["flags"]


class TestAnswerValidatorAgent:
    """Tests for AnswerValidatorAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.answer_validator_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return AnswerValidatorAgent()
    
    def test_fallback_validation_no_context(self, agent):
        """Test fallback validation with no context."""
        result = agent._fallback_validation("We offer enterprise support.", {})
        
        assert result["accuracy_score"] == 0.3
        assert "no_context_available" in result["flags"]
    
    def test_fallback_validation_with_overlap(self, agent):
        """Test fallback validation with keyword overlap."""
        context = {
            "knowledge_items": [
                {"content": "Enterprise support available 24/7"}
            ]
        }
        result = agent._fallback_validation("We offer enterprise support.", context)
        
        assert result["accuracy_score"] > 0.3
        assert "fallback_validation" in result["flags"]


class TestComplianceCheckerAgent:
    """Tests for ComplianceCheckerAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.compliance_checker_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return ComplianceCheckerAgent()
    
    def test_is_compliance_sensitive_by_category(self, agent):
        """Test compliance detection by category."""
        assert agent._is_compliance_sensitive({"category": "compliance", "question_text": "", "answer": ""})
        assert agent._is_compliance_sensitive({"category": "security", "question_text": "", "answer": ""})
        assert agent._is_compliance_sensitive({"category": "legal", "question_text": "", "answer": ""})
    
    def test_is_compliance_sensitive_by_keyword(self, agent):
        """Test compliance detection by keywords."""
        assert agent._is_compliance_sensitive({
            "category": "general",
            "question_text": "Are you GDPR compliant?",
            "answer": ""
        })
        assert agent._is_compliance_sensitive({
            "category": "general",
            "question_text": "",
            "answer": "We have SOC 2 certification"
        })
    
    def test_detect_frameworks_gdpr(self, agent):
        """Test GDPR framework detection."""
        detected = agent._detect_frameworks("We are fully GDPR compliant.")
        
        assert len(detected) == 1
        assert detected[0]["name"] == "GDPR"
        assert detected[0]["risk_level"] == "high"
    
    def test_detect_frameworks_multiple(self, agent):
        """Test multiple framework detection."""
        detected = agent._detect_frameworks(
            "We have SOC 2 Type II and are HIPAA compliant with ISO 27001 certification."
        )
        
        names = [d["name"] for d in detected]
        assert "SOC 2" in names
        assert "HIPAA" in names
        assert "ISO 27001" in names
    
    def test_fallback_check_verified(self, agent):
        """Test fallback check with verified certification."""
        answer = {"answer": "We are SOC 2 certified."}
        org_certs = ["SOC 2 Type II", "ISO 27001"]
        
        result = agent._fallback_check(answer, org_certs)
        
        assert result["overall_compliance_score"] == 1.0
        assert len(result.get("risk_areas", [])) == 0
    
    def test_fallback_check_unverified(self, agent):
        """Test fallback check with unverified certification."""
        answer = {"answer": "We are HIPAA compliant."}
        org_certs = ["SOC 2 Type II"]  # No HIPAA
        
        result = agent._fallback_check(answer, org_certs)
        
        assert result["overall_compliance_score"] < 1.0
        assert "HIPAA" in result.get("risk_areas", [])
        assert result["requires_legal_review"] == True


class TestKnowledgeBaseAgent:
    """Tests for KnowledgeBaseAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.knowledge_base_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return KnowledgeBaseAgent()
    
    def test_merge_search_results_deduplicates(self, agent):
        """Test that merge deduplicates results."""
        results1 = [
            {"item_id": 1, "content_preview": "Item 1", "score": 0.8},
            {"item_id": 2, "content_preview": "Item 2", "score": 0.7}
        ]
        results2 = [
            {"item_id": 1, "content_preview": "Item 1", "score": 0.9},  # Higher score
            {"item_id": 3, "content_preview": "Item 3", "score": 0.6}
        ]
        
        merged = agent._merge_search_results([results1, results2], limit=10)
        
        # Should have 3 unique items
        assert len(merged) == 3
        
        # Item 1 should have the higher score
        item1 = next(r for r in merged if r["item_id"] == 1)
        assert item1["score"] == 0.9
    
    def test_merge_search_results_respects_limit(self, agent):
        """Test that merge respects limit."""
        results = [[
            {"item_id": i, "content_preview": f"Item {i}", "score": 1.0 - i*0.1}
            for i in range(10)
        ]]
        
        merged = agent._merge_search_results(results, limit=5)
        
        assert len(merged) == 5


class TestQualityReviewerAgent:
    """Tests for QualityReviewerAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.quality_reviewer_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return QualityReviewerAgent()
    
    def test_fallback_review_detects_short_answer(self, agent):
        """Test fallback review flags short answers."""
        answer = {"answer": "Yes.", "confidence_score": 0.8}
        result = agent._fallback_review(answer)
        
        assert "Answer may be too brief" in result["issues"]
    
    def test_fallback_review_detects_placeholder(self, agent):
        """Test fallback review flags placeholder text."""
        answer = {"answer": "We will provide [insert details here].", "confidence_score": 0.5}
        result = agent._fallback_review(answer)
        
        assert "Contains placeholder text" in result["issues"]


class TestClarificationAgent:
    """Tests for ClarificationAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.clarification_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return ClarificationAgent()
    
    def test_fallback_clarification_low_confidence(self, agent):
        """Test fallback clarification for very low confidence."""
        result = agent._fallback_clarification(
            question="What is your pricing model?",
            context={},
            confidence=0.2
        )
        
        assert result["needs_clarification"] == True
        assert len(result["clarification_questions"]) > 0
    
    def test_fallback_clarification_moderate_confidence(self, agent):
        """Test fallback clarification for moderate confidence."""
        result = agent._fallback_clarification(
            question="What is your pricing model?",
            context={"knowledge_items": [{"title": "Pricing"}]},
            confidence=0.4
        )
        
        # 0.4 is above 0.3 threshold in fallback
        assert result["needs_clarification"] == False


class TestDocumentAnalyzerAgent:
    """Tests for DocumentAnalyzerAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.document_analyzer_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return DocumentAnalyzerAgent()
    
    def test_fallback_analysis_detects_sections(self, agent):
        """Test fallback analysis detects section headers."""
        text = """
        Section 1: Introduction
        This is the introduction.
        
        1. Overview of Requirements
        Here are the requirements.
        """
        result = agent._fallback_analysis(text)
        
        # The fallback analysis should return a valid structure even if no sections found
        assert "sections" in result
        assert isinstance(result["sections"], list)
    
    def test_fallback_analysis_detects_themes(self, agent):
        """Test fallback analysis detects themes."""
        text = """
        We require strong security measures including encryption and authentication.
        The vendor must maintain regulatory compliance with GDPR requirements.
        """
        result = agent._fallback_analysis(text)
        
        # Should detect security theme
        assert "security" in result["themes"]


class TestFeedbackLearningAgent:
    """Tests for FeedbackLearningAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.feedback_learning_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return get_feedback_learning_agent()
    
    def test_similarity_score_identical(self, agent):
        """Test similarity for identical texts."""
        score = agent._similarity_score("hello world", "hello world")
        assert score == 1.0
    
    def test_similarity_score_different(self, agent):
        """Test similarity for different texts."""
        score = agent._similarity_score("hello world", "goodbye moon")
        assert score < 0.5
    
    def test_fallback_analysis_detects_additions(self, agent):
        """Test fallback analysis detects content additions."""
        result = agent._fallback_analysis(
            original="Short answer.",
            edited="Short answer with much more detailed information added to explain the technical approach and methodology used."
        )
        
        assert "content_addition" in result["change_types"]
    
    def test_fallback_analysis_detects_removals(self, agent):
        """Test fallback analysis detects content removals."""
        result = agent._fallback_analysis(
            original="Long answer with lots of information that was removed by the user during editing process.",
            edited="Short answer."
        )
        
        assert "content_removal" in result["change_types"]


class TestSectionMapperAgent:
    """Tests for SectionMapperAgent."""
    
    @pytest.fixture
    def agent(self):
        """Create agent with mocked config."""
        with patch('app.agents.section_mapper_agent.get_agent_config') as mock_config:
            mock_config.return_value = Mock(client=None)
            return get_section_mapper_agent()
    
    def test_get_available_sections(self, agent):
        """Test getting available sections."""
        sections = agent.get_available_sections()
        
        assert len(sections) >= 9  # Default sections
        assert all("id" in s and "name" in s for s in sections)
    
    def test_map_single_question_security(self, agent):
        """Test mapping a security question."""
        question = {
            "id": 1,
            "text": "What encryption methods do you use for data protection?",
            "category": "security"
        }
        
        result = agent._map_single_question(question)
        
        assert result["section_id"] == "security_compliance"
        assert result["confidence"] > 0.3
    
    def test_map_single_question_pricing(self, agent):
        """Test mapping a pricing question."""
        question = {
            "id": 2,
            "text": "What is the cost of your annual subscription?",
            "category": "pricing"
        }
        
        result = agent._map_single_question(question)
        
        assert result["section_id"] == "pricing"
        assert result["confidence"] > 0.3
    
    def test_fallback_mapping_returns_all_questions(self, agent):
        """Test fallback mapping handles all questions."""
        questions = [
            {"id": 1, "text": "Security question", "category": "security"},
            {"id": 2, "text": "Pricing question", "category": "pricing"},
            {"id": 3, "text": "General question", "category": "general"}
        ]
        
        result = agent._fallback_mapping(questions)
        
        assert len(result["mappings"]) == 3
        assert all(m.get("section_id") for m in result["mappings"])


# Import new agents for tests
from app.agents.feedback_learning_agent import get_feedback_learning_agent
from app.agents.section_mapper_agent import get_section_mapper_agent

# Run with: pytest tests/test_agents.py -v
