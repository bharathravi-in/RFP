"""
LLM Service Helper

Provides a unified way to get the configured LLM provider for any service.
This is the single source of truth for LLM provider selection.
"""
import logging
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)


def get_llm_provider(org_id: int, agent_type: str = 'default'):
    """
    Get the configured LLM provider for an organization.
    
    This is the main entry point for all services to get their LLM provider.
    It reads the configuration from the database and creates the appropriate
    provider instance.
    
    Args:
        org_id: Organization ID
        agent_type: Type of agent (e.g., 'default', 'answer_generation', 'diagram_generation')
        
    Returns:
        BaseLLMProvider instance configured for the organization
        
    Raises:
        ValueError: If no valid configuration is found
    """
    from app.services.ai_config_service import AIConfigService
    from app.services.llm_providers import LLMProviderFactory
    
    try:
        # Get configuration from database
        config = AIConfigService.get_agent_config(org_id, agent_type)
        
        if not config:
            # Try to get default config if specific agent config not found
            if agent_type != 'default':
                config = AIConfigService.get_agent_config(org_id, 'default')
        
        if not config:
            raise ValueError(f"No LLM configuration found for org {org_id}")
        
        # Debug logging
        print(f"[LLM_HELPER] Config loaded for org {org_id}, agent {agent_type}:")
        print(f"[LLM_HELPER]   provider = {config.provider}")
        print(f"[LLM_HELPER]   model = {config.model}")
        print(f"[LLM_HELPER]   api_endpoint = {getattr(config, 'api_endpoint', None)}")
        
        # Get the API key
        api_key = config.get_api_key()
        if not api_key:
            raise ValueError(f"No API key configured for org {org_id}")
        
        # Only pass base_url for providers that need it (LiteLLM and Azure)
        # OpenAI and Google should use their default endpoints
        provider_name = config.provider
        base_url = None
        if provider_name in ('litellm', 'azure'):
            base_url = getattr(config, 'api_endpoint', None) or getattr(config, 'base_url', None)
        
        print(f"[LLM_HELPER] Creating {provider_name} provider with base_url: {base_url}")
        
        # Create the provider
        provider = LLMProviderFactory.create(
            provider=provider_name,
            api_key=api_key,
            model=config.model,
            base_url=base_url,
            temperature=getattr(config, 'temperature', 0.7) or 0.7,
            max_tokens=getattr(config, 'max_tokens', 4096) or 4096
        )
        
        print(f"[LLM_HELPER] ✓ Successfully created {type(provider).__name__}")
        logger.info(f"Created {provider_name} provider with model {config.model} for org {org_id}")
        return provider
        
    except Exception as e:
        logger.error(f"Failed to get LLM provider for org {org_id}: {e}")
        raise


def generate_content(org_id: int, prompt: str, agent_type: str = 'default', **kwargs) -> str:
    """
    Convenience function to generate content using the configured provider.
    
    Includes automatic OpenTelemetry tracing for LLM calls.
    
    Args:
        org_id: Organization ID
        prompt: The prompt to generate content from
        agent_type: Type of agent configuration to use
        **kwargs: Additional generation parameters
        
    Returns:
        Generated text content
    """
    provider = get_llm_provider(org_id, agent_type)
    
    # Trace the LLM call if telemetry is available
    try:
        from app.utils.telemetry import trace_llm_call
        with trace_llm_call(
            provider=provider.provider_name,
            model=provider.model,
            agent_type=agent_type,
            org_id=org_id
        ):
            return provider.generate_content(prompt, **kwargs)
    except ImportError:
        # Telemetry not available, call directly
        return provider.generate_content(prompt, **kwargs)


def test_provider_connection(org_id: int, agent_type: str = 'default') -> dict:
    """
    Test the LLM provider connection for an organization.
    
    Args:
        org_id: Organization ID
        agent_type: Type of agent configuration to use
        
    Returns:
        Dict with success status, message, and model info
    """
    try:
        provider = get_llm_provider(org_id, agent_type)
        return provider.test_connection()
    except Exception as e:
        return {
            'success': False,
            'message': str(e),
            'model': None
        }
