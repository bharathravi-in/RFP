"""
Streaming LLM Response Support

Provides async generators for streaming LLM responses to clients.
"""
import asyncio
import logging
from typing import AsyncIterator, Dict, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class StreamingResponse:
    """Wrapper for streaming LLM responses."""
    
    def __init__(self, chunks: AsyncIterator[str], metadata: Dict = None):
        self.chunks = chunks
        self.metadata = metadata or {}
        self._full_content = []
    
    async def __aiter__(self):
        async for chunk in self.chunks:
            self._full_content.append(chunk)
            yield chunk
    
    def get_full_content(self) -> str:
        """Get the full content after streaming is complete."""
        return ''.join(self._full_content)


async def stream_litellm(
    model: str,
    prompt: str,
    api_key: str = None,
    base_url: str = None,
    **kwargs
) -> AsyncIterator[str]:
    """
    Stream responses from LiteLLM-compatible endpoints.
    
    Args:
        model: Model name
        prompt: The prompt
        api_key: API key
        base_url: Base URL for LiteLLM proxy
        **kwargs: Additional parameters
        
    Yields:
        Text chunks as they arrive
    """
    try:
        import litellm
        
        if base_url:
            litellm.api_base = base_url
        if api_key:
            litellm.api_key = api_key
        
        response = await litellm.acompletion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            **kwargs
        )
        
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
                
    except ImportError:
        raise ImportError("litellm required for streaming: pip install litellm")
    except Exception as e:
        logger.error(f"Streaming error: {e}")
        raise


async def stream_openai(
    model: str,
    prompt: str,
    api_key: str,
    **kwargs
) -> AsyncIterator[str]:
    """
    Stream responses from OpenAI API.
    
    Args:
        model: Model name (e.g., 'gpt-4o')
        prompt: The prompt
        api_key: OpenAI API key
        **kwargs: Additional parameters
        
    Yields:
        Text chunks as they arrive
    """
    try:
        from openai import AsyncOpenAI
        
        client = AsyncOpenAI(api_key=api_key)
        
        stream = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            **kwargs
        )
        
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
                
    except ImportError:
        raise ImportError("openai required for streaming: pip install openai")
    except Exception as e:
        logger.error(f"OpenAI streaming error: {e}")
        raise


async def stream_google(
    model: str,
    prompt: str,
    api_key: str,
    **kwargs
) -> AsyncIterator[str]:
    """
    Stream responses from Google Generative AI.
    
    Args:
        model: Model name (e.g., 'gemini-1.5-flash')
        prompt: The prompt
        api_key: Google API key
        **kwargs: Additional parameters
        
    Yields:
        Text chunks as they arrive
    """
    try:
        import google.generativeai as genai
        
        genai.configure(api_key=api_key)
        model_instance = genai.GenerativeModel(model)
        
        response = await model_instance.generate_content_async(
            prompt,
            stream=True,
            **kwargs
        )
        
        async for chunk in response:
            if chunk.text:
                yield chunk.text
                
    except ImportError:
        raise ImportError("google-generativeai required: pip install google-generativeai")
    except Exception as e:
        logger.error(f"Google streaming error: {e}")
        raise


class StreamingProvider(ABC):
    """Abstract base class for streaming providers."""
    
    @abstractmethod
    async def stream_content(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        """Stream content from the provider."""
        pass


class LiteLLMStreamingProvider(StreamingProvider):
    """LiteLLM streaming provider."""
    
    def __init__(self, model: str, api_key: str = None, base_url: str = None):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
    
    async def stream_content(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        async for chunk in stream_litellm(
            model=self.model,
            prompt=prompt,
            api_key=self.api_key,
            base_url=self.base_url,
            **kwargs
        ):
            yield chunk


class OpenAIStreamingProvider(StreamingProvider):
    """OpenAI streaming provider."""
    
    def __init__(self, model: str, api_key: str):
        self.model = model
        self.api_key = api_key
    
    async def stream_content(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        async for chunk in stream_openai(
            model=self.model,
            prompt=prompt,
            api_key=self.api_key,
            **kwargs
        ):
            yield chunk


def get_streaming_provider(
    provider: str,
    model: str,
    api_key: str = None,
    base_url: str = None
) -> StreamingProvider:
    """
    Factory function to get a streaming provider.
    
    Args:
        provider: Provider name (litellm, openai, google)
        model: Model name
        api_key: API key
        base_url: Base URL (for LiteLLM)
        
    Returns:
        StreamingProvider instance
    """
    providers = {
        'litellm': lambda: LiteLLMStreamingProvider(model, api_key, base_url),
        'openai': lambda: OpenAIStreamingProvider(model, api_key),
    }
    
    if provider not in providers:
        raise ValueError(f"Unknown streaming provider: {provider}")
    
    return providers[provider]()


# Flask SSE helper
def create_sse_response(async_generator):
    """
    Create a Flask SSE response from an async generator.
    
    Usage in Flask route:
        @app.route('/api/stream')
        async def stream():
            async def generate():
                async for chunk in provider.stream_content(prompt):
                    yield chunk
            return create_sse_response(generate())
    """
    from flask import Response
    
    def sync_generator():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            agen = async_generator.__aiter__()
            while True:
                try:
                    chunk = loop.run_until_complete(agen.__anext__())
                    yield f"data: {chunk}\n\n"
                except StopAsyncIteration:
                    break
        finally:
            loop.close()
        
        yield "data: [DONE]\n\n"
    
    return Response(
        sync_generator(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )
