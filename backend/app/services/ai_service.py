"""AI service for answer generation using Google Gemini."""
import os
from typing import Optional


class AIService:
    """Handle AI-powered answer generation."""
    
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.model = os.getenv('GOOGLE_MODEL', 'gemini-1.5-pro')
        self._client = None
    
    @property
    def client(self):
        """Lazy load the Google AI client."""
        if self._client is None and self.api_key:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(self.model)
        return self._client
    
    def generate_answer(
        self,
        question: str,
        context: list[str],
        tone: str = 'professional',
        length: str = 'medium'
    ) -> dict:
        """
        Generate an AI answer for a question.
        
        Args:
            question: The RFP question to answer
            context: List of relevant knowledge base snippets
            tone: Desired tone (professional, formal, friendly)
            length: Desired length (short, medium, long)
        
        Returns:
            Dict with content, confidence_score, and sources
        """
        if not self.client:
            # Fallback for when API key is not configured
            return {
                'content': f'[AI service not configured. Question: {question[:100]}...]',
                'confidence_score': 0.0,
                'sources': []
            }
        
        # Build prompt
        context_text = '\n\n---\n\n'.join(context) if context else 'No relevant context found.'
        
        length_instruction = {
            'short': 'Keep the answer concise, 2-3 sentences.',
            'medium': 'Provide a balanced answer, 4-6 sentences.',
            'long': 'Provide a detailed, comprehensive answer.'
        }.get(length, '')
        
        prompt = f"""You are an expert RFP response writer. Answer the following question based on the provided context.

CONTEXT:
{context_text}

QUESTION:
{question}

INSTRUCTIONS:
- Use a {tone} tone
- {length_instruction}
- If the context doesn't contain relevant information, provide a general best-practice answer
- Be accurate and specific
- Cite sources when possible

ANSWER:"""

        try:
            response = self.client.generate_content(prompt)
            content = response.text
            
            # Estimate confidence based on context relevance
            confidence = 0.85 if context else 0.6
            
            return {
                'content': content,
                'confidence_score': confidence,
                'sources': [{'title': 'Knowledge Base', 'relevance': 0.9}] if context else []
            }
        except Exception as e:
            return {
                'content': f'Error generating answer: {str(e)}',
                'confidence_score': 0.0,
                'sources': []
            }
    
    def modify_answer(
        self,
        original: str,
        action: str
    ) -> str:
        """
        Modify an existing answer.
        
        Args:
            original: The original answer text
            action: One of 'shorten', 'expand', 'improve_tone'
        
        Returns:
            Modified answer text
        """
        if not self.client:
            return original
        
        prompts = {
            'shorten': f"Make this answer more concise while keeping key information:\n\n{original}",
            'expand': f"Expand this answer with more detail and examples:\n\n{original}",
            'improve_tone': f"Improve the professional tone of this answer:\n\n{original}"
        }
        
        prompt = prompts.get(action, original)
        
        try:
            response = self.client.generate_content(prompt)
            return response.text
        except Exception:
            return original


# Singleton instance
ai_service = AIService()
