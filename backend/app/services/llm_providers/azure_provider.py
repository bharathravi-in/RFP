"""
Azure OpenAI Provider for LLM Integration

Provides access to Azure-hosted OpenAI models.
"""
import logging
from typing import Dict, Any, List, Optional

from .base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)


class AzureOpenAIProvider(BaseLLMProvider):
    """Azure OpenAI provider implementation."""
    
    def __init__(
        self,
        api_key: str,
        model: str = 'gpt-4',
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        api_version: str = '2024-02-15-preview',
        deployment_name: Optional[str] = None,
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
        self.api_version = api_version
        self.deployment_name = deployment_name or model
        self._client = None
        
        # Initialize client
        self._init_client()
    
    def _init_client(self):
        """Initialize the Azure OpenAI client."""
        try:
            from openai import AzureOpenAI
            
            if not self.base_url:
                raise ValueError("Azure OpenAI requires a base_url (Azure endpoint)")
            
            self._client = AzureOpenAI(
                api_key=self.api_key,
                api_version=self.api_version,
                azure_endpoint=self.base_url
            )
            logger.info(f"Azure OpenAI client initialized with deployment: {self.deployment_name}")
            
        except ImportError:
            logger.error("OpenAI package not installed. Run: pip install openai")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Azure OpenAI client: {e}")
            raise
    
    @property
    def provider_name(self) -> str:
        return "azure"
    
    def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate content from a prompt using Azure OpenAI.
        
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
                model=self.deployment_name,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=kwargs.get('temperature', self.temperature),
                max_tokens=kwargs.get('max_tokens', self.max_tokens),
            )
            
            content = response.choices[0].message.content
            logger.debug(f"Azure OpenAI generated {len(content)} characters")
            return content
            
        except Exception as e:
            logger.error(f"Azure OpenAI generation error: {e}")
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
                model=self.deployment_name,
                messages=messages,
                temperature=kwargs.get('temperature', self.temperature),
                max_tokens=kwargs.get('max_tokens', self.max_tokens),
            )
            
            content = response.choices[0].message.content
            logger.debug(f"Azure OpenAI chat generated {len(content)} characters")
            return content
            
        except Exception as e:
            logger.error(f"Azure OpenAI chat generation error: {e}")
            raise
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the Azure OpenAI connection."""
        try:
            result = self.generate_content("Say 'Azure connected' in 5 words or less.")
            return {
                'success': True,
                'message': f'Connected to Azure OpenAI',
                'model': self.deployment_name,
                'sample_response': result[:100] if result else ''
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Azure OpenAI connection failed: {str(e)}',
                'model': self.deployment_name
            }
