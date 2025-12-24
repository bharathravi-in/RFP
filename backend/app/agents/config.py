"""
Agent Configuration for Google ADK Multi-Agent System

Provides base configuration and utilities for all ADK agents.
Now with support for LiteLLM proxy and dynamic database-driven configuration.
"""
import os
from typing import Optional
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

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
            org_id: Organization ID for database config lookup (REQUIRED)
            agent_type: Type of agent (e.g., 'rfp_analysis', 'answer_generation')
        """
        self.api_key = None
        self.model_name = None
        self.provider = None
        self.base_url = None
        self.temperature = 0.7
        self.max_tokens = 4096
        self._client = None
        self._llm_provider = None
        self.org_id = org_id
        self.agent_type = agent_type
        
        # Load from database - this is the only source of configuration
        if org_id:
            self._load_from_database(org_id, agent_type)
        else:
            logger.warning(
                f"No org_id provided for agent '{agent_type}'. "
                "Configuration must be loaded from database."
            )
    
    def _load_from_database(self, org_id: int, agent_type: str):
        """Load configuration from database."""
        try:
            from app.services.ai_config_service import AIConfigService
            
            config = AIConfigService.get_agent_config(org_id, agent_type)
            if config:
                self.api_key = config.get_api_key()
                self.model_name = config.model
                self.provider = config.provider
                self.base_url = getattr(config, 'base_url', None) or config.api_endpoint
                self.temperature = getattr(config, 'temperature', 0.7) or 0.7
                self.max_tokens = getattr(config, 'max_tokens', 4096) or 4096
                
                # Check config_metadata for additional settings
                metadata = config.config_metadata or {}
                if 'temperature' in metadata:
                    self.temperature = metadata['temperature']
                if 'max_tokens' in metadata:
                    self.max_tokens = metadata['max_tokens']
                
                logger.info(
                    f"✓ Loaded {agent_type} config from database: "
                    f"{self.provider}/{self.model_name}"
                )
        except Exception as e:
            logger.warning(f"Failed to load config from database: {e}")
    
    def _load_from_environment(self):
        """Load configuration from environment variables (fallback)."""
        # Check for LiteLLM configuration first
        litellm_base_url = os.getenv('LITELLM_BASE_URL')
        litellm_api_key = os.getenv('LITELLM_API_KEY')
        litellm_model = os.getenv('LITELLM_MODEL')
        
        if litellm_base_url and litellm_api_key:
            self.provider = 'litellm'
            self.api_key = litellm_api_key
            self.base_url = litellm_base_url
            self.model_name = litellm_model or 'gemini-flash'
            logger.info(
                f"✓ Loaded LiteLLM config from environment: "
                f"{self.provider}/{self.model_name}"
            )
        else:
            # Fall back to Google AI
            self.api_key = os.getenv('GOOGLE_API_KEY')
            self.model_name = os.getenv('GOOGLE_MODEL', 'gemini-1.5-flash')
            self.provider = 'google'
            if self.api_key:
                logger.info(
                    f"✓ Loaded Google AI config from environment: "
                    f"{self.provider}/{self.model_name}"
                )
    
    def _create_llm_provider(self):
        """Create LLM provider instance based on configuration."""
        try:
            from app.services.llm_providers import LLMProviderFactory
            
            # Only pass base_url for providers that need it
            base_url = self.base_url if self.provider in ('litellm', 'azure') else None
            
            return LLMProviderFactory.create(
                provider=self.provider,
                api_key=self.api_key,
                model=self.model_name,
                base_url=base_url,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
        except ImportError as e:
            logger.warning(f"LLM provider factory not available: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to create LLM provider: {e}")
            return None
    
    @property
    def llm_provider(self):
        """Get or create the LLM provider instance."""
        if self._llm_provider is None and self.api_key:
            self._llm_provider = self._create_llm_provider()
        return self._llm_provider
    
    @property
    def client(self):
        """
        Get or create the client.
        Returns a wrapper that provides .models.generate_content() interface
        for all provider types.
        """
        if self._client is None and self.api_key:
            # For LiteLLM, OpenAI, and Azure, use the unified wrapper
            if self.provider in ('litellm', 'openai', 'azure'):
                provider = self.llm_provider
                if provider:
                    self._client = LiteLLMClientWrapper(provider, self.model_name)
                return self._client
            
            # For Google, use the appropriate SDK
            if self.provider == 'google':
                if ADK_AVAILABLE:
                    self._client = genai.Client(api_key=self.api_key)
                else:
                    genai_legacy.configure(api_key=self.api_key)
                    self._client = genai_legacy.GenerativeModel(self.model_name)
        return self._client
    
    @property
    def is_adk_enabled(self) -> bool:
        """Check if ADK is available and configured (only for Google provider)."""
        return ADK_AVAILABLE and self.api_key is not None and self.provider == 'google'
    
    @property
    def is_litellm_enabled(self) -> bool:
        """Check if using LiteLLM provider."""
        return self.provider == 'litellm' and self.api_key is not None
    
    @property
    def is_openai_enabled(self) -> bool:
        """Check if using OpenAI provider."""
        return self.provider == 'openai' and self.api_key is not None
    
    @property
    def is_azure_enabled(self) -> bool:
        """Check if using Azure OpenAI provider."""
        return self.provider == 'azure' and self.api_key is not None
    
    def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate content using the configured provider.
        
        This is a unified interface that works with both LiteLLM and Google AI.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        if self.is_litellm_enabled and self.llm_provider:
            return self.llm_provider.generate_content(prompt, **kwargs)
        
        if self.client:
            if self.is_adk_enabled:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                return response.text
            else:
                response = self.client.generate_content(prompt)
                return response.text
        
        raise RuntimeError("No LLM provider configured")


class LiteLLMClientWrapper:
    """
    Wrapper to provide Google ADK-compatible interface for LiteLLM provider.
    Allows existing code using client.models.generate_content() to work with LiteLLM.
    Also handles client.generate_content(prompt) calls.
    """
    
    def __init__(self, provider, model_name: str):
        self._provider = provider
        self._model_name = model_name
        self.models = self  # Allow client.models.generate_content() syntax
    
    def generate_content(self, prompt_or_model: str = None, contents: str = None, **kwargs) -> 'LiteLLMResponse':
        """
        Generate content using LiteLLM, matching Google ADK interface.
        
        Handles multiple calling patterns:
        - client.generate_content("prompt")  <- legacy call
        - client.models.generate_content(model="x", contents="prompt") <- ADK call
        - client.generate_content(contents="prompt") <- keyword call
        
        Args:
            prompt_or_model: Either the prompt (legacy) or model name (ADK)
            contents: The prompt when using ADK-style call
            **kwargs: Additional generation parameters
        
        Returns:
            LiteLLMResponse with .text attribute
        """
        # Determine the prompt based on calling pattern
        if contents is not None:
            # ADK-style call: generate_content(model="x", contents="prompt")
            prompt = contents
        elif prompt_or_model is not None:
            # Legacy call: generate_content("prompt") 
            prompt = prompt_or_model
        else:
            # Try kwargs
            prompt = kwargs.get('prompt', '')
        
        if isinstance(prompt, list):
            prompt = '\n'.join(str(p) for p in prompt)
        
        result = self._provider.generate_content(str(prompt))
        return LiteLLMResponse(result)


class LiteLLMResponse:
    """Response wrapper to match Google ADK response structure."""
    
    def __init__(self, text: str):
        self.text = text


def get_agent_config(org_id: int = None, agent_type: str = 'default') -> AgentConfig:
    """
    Factory function to get agent configuration.
    
    NOTE: Caching removed to ensure fresh database lookups.
    
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
    CLARIFICATION_QUESTIONS = "clarification_questions"
    AGENT_MESSAGES = "agent_messages"
    CURRENT_STEP = "current_step"
    ERRORS = "errors"
