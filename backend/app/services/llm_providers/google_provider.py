"""
Google AI Provider

Provides LLM access through Google's Generative AI SDK.
Supports Gemini models directly via Google AI.
"""
import logging
from typing import Optional, Dict, Any, List

try:
    import google.generativeai as genai
    GOOGLE_AI_AVAILABLE = True
except ImportError:
    GOOGLE_AI_AVAILABLE = False
    genai = None

from .base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)


class GoogleAIProvider(BaseLLMProvider):
    """
    LLM Provider using Google's Generative AI SDK directly.
    
    Supports models:
    - gemini-1.5-pro
    - gemini-1.5-flash
    - gemini-pro
    """
    
    AVAILABLE_MODELS = [
        {
            'model_name': 'gemini-1.5-pro',
            'display_name': 'Gemini 1.5 Pro',
            'description': 'Most capable model for complex tasks'
        },
        {
            'model_name': 'gemini-1.5-flash', 
            'display_name': 'Gemini 1.5 Flash',
            'description': 'Fast and efficient for most tasks'
        },
        {
            'model_name': 'gemini-pro',
            'display_name': 'Gemini Pro',
            'description': 'Previous generation model'
        }
    ]
    
    def __init__(
        self,
        api_key: str,
        model: str = 'gemini-1.5-flash',
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        """
        Initialize Google AI provider.
        
        Args:
            api_key: Google AI API key
            model: Model name (e.g., 'gemini-1.5-pro')
            base_url: Not used for Google AI (ignored)
            temperature: Generation temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional config
        """
        super().__init__(
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        
        if not GOOGLE_AI_AVAILABLE:
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )
        
        # Configure Google AI
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model)
        
        logger.info(f"Initialized Google AI provider: model={model}")
    
    @property
    def provider_name(self) -> str:
        return "google"
    
    def generate_content(self, prompt: str, **kwargs) -> str:
        """
        Generate content from a prompt.
        
        Args:
            prompt: The input prompt
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text content
        """
        try:
            # Build generation config
            generation_config = genai.GenerationConfig(
                temperature=kwargs.get('temperature', self.temperature),
                max_output_tokens=kwargs.get('max_tokens', self.max_tokens),
            )
            
            if 'top_p' in kwargs:
                generation_config.top_p = kwargs['top_p']
            if 'top_k' in kwargs:
                generation_config.top_k = kwargs['top_k']
            
            logger.debug(f"Google AI request: model={self.model}")
            
            response = self._model.generate_content(
                prompt,
                generation_config=generation_config
            )
            
            content = response.text
            
            logger.debug(f"Google AI response: {len(content)} chars")
            
            return content
            
        except Exception as e:
            logger.error(f"Google AI generation error: {e}")
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
        try:
            # Convert messages to Google AI format
            chat = self._model.start_chat(history=[])
            
            # Process all messages except the last one as history
            for msg in messages[:-1]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                
                if role == 'user':
                    chat.send_message(content)
                # Note: Google AI handles assistant messages automatically
            
            # Send the last message and get response
            last_msg = messages[-1] if messages else {'content': ''}
            
            generation_config = genai.GenerationConfig(
                temperature=kwargs.get('temperature', self.temperature),
                max_output_tokens=kwargs.get('max_tokens', self.max_tokens),
            )
            
            response = chat.send_message(
                last_msg.get('content', ''),
                generation_config=generation_config
            )
            
            return response.text
            
        except Exception as e:
            logger.error(f"Google AI chat error: {e}")
            raise
    
    @classmethod
    def get_available_models(cls) -> List[Dict[str, str]]:
        """Get list of available models."""
        return cls.AVAILABLE_MODELS.copy()
