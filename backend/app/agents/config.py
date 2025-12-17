"""
Agent Configuration for Google ADK Multi-Agent System

Provides base configuration and utilities for all ADK agents.
"""
import os
from typing import Optional
from functools import lru_cache

# Google ADK imports
try:
    from google import genai
    from google.genai import types
    ADK_AVAILABLE = True
except ImportError:
    ADK_AVAILABLE = False
    genai = None
    types = None

# Fallback to standard google-generativeai if ADK not available
import google.generativeai as genai_legacy


class AgentConfig:
    """Configuration for ADK agents with database-backed agent-specific settings."""
    
    def __init__(self, org_id: int = None, agent_type: str = 'default'):
        """
        Initialize agent configuration.
        
        Args:
            org_id: Organization ID for database config lookup
            agent_type: Type of agent (e.g., 'rfp_analysis', 'answer_generation')
        """
        self.api_key = None
        self.model_name = None
        self.provider = None
        self._client = None
        
        # Try to get from database first
        if org_id:
            self._load_from_database(org_id, agent_type)
        
        # Fallback to environment variables if database config not found
        if not self.api_key:
            self._load_from_environment()
    
    def _load_from_database(self, org_id: int, agent_type: str):
        """Load configuration from database."""
        try:
            from app.services.ai_config_service import AIConfigService
            
            config = AIConfigService.get_agent_config(org_id, agent_type)
            if config:
                self.api_key = config.get_api_key()
                self.model_name = config.model
                self.provider = config.provider
                print(f"✓ Loaded {agent_type} config from database: {self.provider}/{self.model_name}")
        except Exception as e:
            print(f"Warning: Failed to load config from database: {e}")
    
    def _load_from_environment(self):
        """Load configuration from environment variables (fallback)."""
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.model_name = os.getenv('GOOGLE_MODEL', 'gemini-1.5-flash')
        self.provider = 'google'
        if self.api_key:
            print(f"✓ Loaded config from environment: {self.provider}/{self.model_name}")
    
    @property
    def client(self):
        """Get or create the Gemini client."""
        if self._client is None and self.api_key:
            if ADK_AVAILABLE:
                self._client = genai.Client(api_key=self.api_key)
            else:
                genai_legacy.configure(api_key=self.api_key)
                self._client = genai_legacy.GenerativeModel(self.model_name)
        return self._client
    
    @property
    def is_adk_enabled(self) -> bool:
        """Check if ADK is available and configured."""
        return ADK_AVAILABLE and self.api_key is not None


@lru_cache(maxsize=1)
def get_agent_config(org_id: int = None, agent_type: str = 'default') -> AgentConfig:
    """
    Factory function to get agent configuration.
    
    Args:
        org_id: Organization ID for database config lookup
        agent_type: Type of agent (e.g., 'rfp_analysis', 'answer_generation')
        
    Returns:
        AgentConfig instance
    """
    return AgentConfig(org_id=org_id, agent_type=agent_type)


# Session state keys for agent communication
class SessionKeys:
    """Standard session state keys for agent-to-agent communication."""
    DOCUMENT_TEXT = "document_text"
    DOCUMENT_STRUCTURE = "document_structure"
    EXTRACTED_QUESTIONS = "extracted_questions"
    KNOWLEDGE_CONTEXT = "knowledge_context"
    DRAFT_ANSWERS = "draft_answers"
    REVIEWED_ANSWERS = "reviewed_answers"
    CLARIFICATION_QUESTIONS = "clarification_questions"  # NEW
    AGENT_MESSAGES = "agent_messages"
    CURRENT_STEP = "current_step"
    ERRORS = "errors"
