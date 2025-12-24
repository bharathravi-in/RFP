"""
OpenAI Provider for LLM Integration

Provides direct access to OpenAI's GPT models.
"""
import logging
from typing import Dict, Any, List, Optional

from .base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI provider implementation."""
    
    def __init__(
        self,
        api_key: str,
        model: str = 'gpt-4-turbo',
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=temperature,
            max_tokens=max_tokens,
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
                'api_key': self.api_key
            }
            
            if self.base_url:
                client_kwargs['base_url'] = self.base_url
            
            self._client = openai.OpenAI(**client_kwargs)
            logger.info(f"OpenAI client initialized with model: {self.model}")
            
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
        Generate content from a prompt using OpenAI.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        if not self._client:
            self._init_client()
        
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=kwargs.get('temperature', self.temperature),
                max_tokens=kwargs.get('max_tokens', self.max_tokens),
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI generated {len(content)} characters")
            return content
            
        except Exception as e:
            logger.error(f"OpenAI generation error: {e}")
            raise
    
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
        if not self._client:
            self._init_client()
        
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get('temperature', self.temperature),
                max_tokens=kwargs.get('max_tokens', self.max_tokens),
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI chat generated {len(content)} characters")
            return content
            
        except Exception as e:
            logger.error(f"OpenAI chat generation error: {e}")
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
