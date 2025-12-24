"""
LiteLLM Provider

Provides LLM access through a LiteLLM proxy server.
Supports multiple models including Gemini variants.

Documentation: https://docs.litellm.ai/docs/
"""
import logging
from typing import Optional, Dict, Any, List

try:
    import litellm
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    litellm = None

from .base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)


class LiteLLMProvider(BaseLLMProvider):
    """
    LLM Provider using LiteLLM proxy.
    
    Supports models:
    - gemini-flash
    - gemini-pro  
    - gemini-flash-lite
    
    Via proxy at: https://litellm.tarento.dev
    """
    
    # Default LiteLLM proxy configuration
    DEFAULT_BASE_URL = "https://litellm.tarento.dev"
    
    # Available models on the proxy
    AVAILABLE_MODELS = [
        {
            'model_name': 'gemini-flash',
            'display_name': 'Gemini Flash',
            'description': 'Fast, efficient model for quick responses'
        },
        {
            'model_name': 'gemini-pro',
            'display_name': 'Gemini Pro',
            'description': 'Most capable model for complex tasks'
        },
        {
            'model_name': 'gemini-flash-lite',
            'display_name': 'Gemini Flash Lite',
            'description': 'Lightweight model for simple tasks'
        }
    ]
    
    def __init__(
        self,
        api_key: str,
        model: str = 'gemini-flash',
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        """
        Initialize LiteLLM provider.
        
        Args:
            api_key: API key for the LiteLLM proxy
            model: Model name (e.g., 'gemini-flash', 'gemini-pro')
            base_url: LiteLLM proxy URL (defaults to tarento dev)
            temperature: Generation temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional config (timeout, etc.)
        """
        super().__init__(
            api_key=api_key,
            model=model,
            base_url=base_url or self.DEFAULT_BASE_URL,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        
        if not LITELLM_AVAILABLE:
            raise ImportError(
                "litellm package not installed. "
                "Install with: pip install litellm"
            )
        
        # Configure litellm
        self._configure_litellm()
        
        logger.info(
            f"Initialized LiteLLM provider: model={model}, "
            f"base_url={self.base_url}"
        )
    
    def _configure_litellm(self):
        """Configure litellm settings."""
        # Set API key 
        litellm.api_key = self.api_key
        
        # Set custom base URL for the proxy
        if self.base_url:
            litellm.api_base = self.base_url
        
        # Drop unsupported params silently
        litellm.drop_params = True
        
        # Set timeout if provided
        timeout = self.extra_config.get('timeout', 60)
        litellm.request_timeout = timeout
    
    @property
    def provider_name(self) -> str:
        return "litellm"
    
    def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate content from a prompt.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        messages = [{"role": "user", "content": prompt}]
        return self.generate_chat(messages, **kwargs)
    
    def generate_chat(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        """
        Generate content from chat messages.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        try:
            # For custom LiteLLM proxy, use openai/ prefix with api_base
            # This tells LiteLLM to use OpenAI-compatible API format
            model_name = f"openai/{self.model}"
            
            # Merge default and override parameters
            params = {
                'model': model_name,
                'messages': messages,
                'temperature': kwargs.get('temperature', self.temperature),
                'max_tokens': kwargs.get('max_tokens', self.max_tokens),
                'api_key': self.api_key,
                'api_base': self.base_url,  # Custom proxy URL
            }
            
            # Add any extra parameters
            for key in ['top_p', 'stop', 'presence_penalty', 'frequency_penalty']:
                if key in kwargs:
                    params[key] = kwargs[key]
            
            logger.debug(f"LiteLLM request: model={model_name}, api_base={self.base_url}")
            
            response = litellm.completion(**params)
            
            # Extract text from response
            content = response.choices[0].message.content
            
            logger.debug(f"LiteLLM response: {len(content)} chars")
            
            return content
            
        except Exception as e:
            logger.error(f"LiteLLM generation error: {e}")
            raise
    
    @classmethod
    def get_available_models(cls) -> List[Dict[str, str]]:
        """Get list of available models on the proxy."""
        return cls.AVAILABLE_MODELS.copy()
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to LiteLLM proxy."""
        try:
            result = self.generate_content(
                "Respond with exactly: 'LiteLLM connection successful'"
            )
            return {
                'success': True,
                'message': f'Connected to LiteLLM proxy at {self.base_url}',
                'model': self.model,
                'provider': 'litellm',
                'sample_response': result[:100] if result else ''
            }
        except Exception as e:
            logger.error(f"LiteLLM connection test failed: {e}")
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}',
                'model': self.model,
                'provider': 'litellm'
            }
