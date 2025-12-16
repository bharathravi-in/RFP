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
    """Configuration for ADK agents."""
    
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.model_name = os.getenv('GOOGLE_MODEL', 'gemini-1.5-flash')
        self._client = None
    
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
def get_agent_config() -> AgentConfig:
    """Get the singleton agent configuration."""
    return AgentConfig()


# Session state keys for agent communication
class SessionKeys:
    """Standard session state keys for agent-to-agent communication."""
    DOCUMENT_TEXT = "document_text"
    DOCUMENT_STRUCTURE = "document_structure"
    EXTRACTED_QUESTIONS = "extracted_questions"
    KNOWLEDGE_CONTEXT = "knowledge_context"
    DRAFT_ANSWERS = "draft_answers"
    REVIEWED_ANSWERS = "reviewed_answers"
    AGENT_MESSAGES = "agent_messages"
    CURRENT_STEP = "current_step"
    ERRORS = "errors"
