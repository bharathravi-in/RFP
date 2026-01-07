"""
OpenAI Provider for LLM Integration

Provides direct access to OpenAI's GPT models with circuit breaker protection.
"""
import logging
from typing import Dict, Any, List, Optional

from .base_provider import BaseLLMProvider
from ..circuit_breaker import llm_circuit_breaker, CircuitOpenError

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI provider implementation with circuit breaker."""
    
    def __init__(
        self,
        api_key: str,
        model: str = 'gpt-4-turbo',
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        timeout_seconds: float = 60.0,
        **kwargs
    ):
        super().__init__(
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
            **kwargs
        )
        self._client = None
        
        # Initialize client
        self._init_client()
    
    def _init_client(self):
        """Initialize the OpenAI client."""
        try:
            import openai
            
            client_kwargs = {
                'api_key': self.api_key,
                'timeout': self.timeout_seconds,  # Add timeout
            }
            
            if self.base_url:
                client_kwargs['base_url'] = self.base_url
            
            self._client = openai.OpenAI(**client_kwargs)
            logger.info(f"OpenAI client initialized with model: {self.model}, timeout: {self.timeout_seconds}s")
            
        except ImportError:
            logger.error("OpenAI package not installed. Run: pip install openai")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            raise
    
    @property
    def provider_name(self) -> str:
        return "openai"
    
    def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate content from a prompt using OpenAI with circuit breaker.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        if not self._client:
            self._init_client()
        
        # Check circuit breaker state
        if not llm_circuit_breaker.allow_request():
            raise CircuitOpenError(
                f"LLM circuit breaker is OPEN. Service temporarily unavailable."
            )
        
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=kwargs.get('temperature', self.temperature),
                max_tokens=kwargs.get('max_tokens', self.max_tokens),
                timeout=kwargs.get('timeout', self.timeout_seconds),
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI generated {len(content)} characters")
            llm_circuit_breaker._record_success()
            return content
            
        except Exception as e:
            logger.error(f"OpenAI generation error: {e}")
            llm_circuit_breaker._record_failure(e)
            raise
    
    def generate_chat(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        """
        Generate content from chat messages with circuit breaker.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        if not self._client:
            self._init_client()
        
        # Check circuit breaker state
        if not llm_circuit_breaker.allow_request():
            raise CircuitOpenError(
                f"LLM circuit breaker is OPEN. Service temporarily unavailable."
            )
        
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get('temperature', self.temperature),
                max_tokens=kwargs.get('max_tokens', self.max_tokens),
                timeout=kwargs.get('timeout', self.timeout_seconds),
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI chat generated {len(content)} characters")
            llm_circuit_breaker._record_success()
            return content
            
        except Exception as e:
            logger.error(f"OpenAI chat generation error: {e}")
            llm_circuit_breaker._record_failure(e)
            raise
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the OpenAI connection."""
        try:
            result = self.generate_content("Say 'OpenAI connected' in 5 words or less.")
            return {
                'success': True,
                'message': f'Connected to OpenAI',
                'model': self.model,
                'sample_response': result[:100] if result else ''
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'OpenAI connection failed: {str(e)}',
                'model': self.model
            }
