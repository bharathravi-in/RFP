"""
Section Generation Service
Handles AI-powered content generation for different RFP section types.
Now uses database-driven LiteLLM configuration.
"""
import os
from typing import Dict, List, Optional
from datetime import datetime


class SectionGenerationService:
    """Generate content for different RFP section types using AI"""
    
    def __init__(self, org_id: int = None):
        """
        Initialize section generator.
        
        Args:
            org_id: Organization ID for database config lookup
        """
        self.org_id = org_id
        self._llm_provider = None
        self._legacy_model = None
    
    def _get_llm_provider(self):
        """Get LLM provider from database configuration using centralized helper.
        
        Note: We reload the provider each time to respect settings changes.
        """
        # Always reload from database to respect settings changes
        if self.org_id:
            try:
                from app.services.llm_service_helper import get_llm_provider
                self._llm_provider = get_llm_provider(self.org_id, 'answer_generation')
                print(f"✓ SectionGenerator using provider: {self._llm_provider.provider_name}/{self._llm_provider.model}")
            except Exception as e:
                print(f"Warning: Could not load LLM config from database: {e}")
                self._llm_provider = None
        return self._llm_provider
    
    def _get_legacy_model(self):
        """Legacy fallback disabled - provider abstraction only."""
        # Legacy Google AI fallback removed - all LLM access should go through llm_service_helper
        return None
    
    def _generate(self, prompt: str) -> str:
        """Generate content using configured LLM provider."""
        # Try dynamic provider from database first
        provider = self._get_llm_provider()
        if provider:
            try:
                return provider.generate_content(prompt)
            except Exception as e:
                print(f"Dynamic provider generation failed, falling back: {e}")
        
        # Fallback to legacy model
        model = self._get_legacy_model()
        if model:
            response = model.generate_content(prompt)
            return response.text
        
        return "AI model not available. Please configure LLM settings in Settings → AI Settings."
    
    def generate_section_content(
        self,
        section_type_slug: str,
        prompt_template: str,
        inputs: Dict,
        context: List[Dict],
        generation_params: Optional[Dict] = None
    ) -> Dict:
        """
        Generate content for a section.
        
        Args:
            section_type_slug: The type of section (e.g., 'company_profile')
            prompt_template: The prompt template with {{variables}}
            inputs: User-provided inputs to fill template variables
            context: Knowledge base context items
            generation_params: Optional parameters like tone, length
        
        Returns:
            Dict with content, confidence_score, sources, flags
        """
        # Prepare the prompt
        prompt = self._prepare_prompt(prompt_template, inputs, context, generation_params)
        
        try:
            # Generate content
            content = self._generate(prompt)
            
            # Calculate confidence based on context availability
            confidence_score = self._calculate_confidence(context, inputs, section_type_slug)
            
            # Extract sources from context
            sources = self._extract_sources(context)
            
            # Detect any flags/warnings
            flags = self._detect_flags(content, context, inputs, section_type_slug)
            
            return {
                'content': content,
                'confidence_score': confidence_score,
                'sources': sources,
                'flags': flags,
            }
            
        except Exception as e:
            print(f"Error generating section content: {e}")
            return {
                'content': f'Error generating content: {str(e)}',
                'confidence_score': 0.0,
                'sources': [],
                'flags': ['generation_error'],
            }
    
    def _prepare_prompt(
        self,
        template: str,
        inputs: Dict,
        context: List[Dict],
        params: Optional[Dict]
    ) -> str:
        """Prepare the full prompt for AI generation"""
        
        # Substitute variables in template
        prompt = template
        for key, value in inputs.items():
            placeholder = '{{' + key + '}}' 
            prompt = prompt.replace(placeholder, str(value) if value else '')
        
        # Add context from knowledge base - this is CRITICAL for quality
        if context:
            context_text = "\n\n---\n## REFERENCE MATERIALS FROM KNOWLEDGE BASE\nUse the following approved content as your PRIMARY reference for format, style, and content:\n"
            for i, item in enumerate(context[:5], 1):  # Limit to top 5 items
                title = item.get('title', 'Untitled')
                content = item.get('content', item.get('content_preview', ''))
                # INCREASED from 500 to 2000 to capture more of proposal templates
                if len(content) > 2000:
                    content = content[:2000] + '...'
                context_text += f"\n### [{i}] {title}:\n{content}\n"
            prompt = f"{prompt}\n{context_text}"
        
        # Add generation parameters
        if params:
            param_text = "\n\nGeneration Parameters:"
            if params.get('tone'):
                param_text += f"\n- Tone: {params['tone']}"
            if params.get('length'):
                param_text += f"\n- Length: {params['length']}"
            if params.get('format'):
                param_text += f"\n- Format: {params['format']}"
            prompt = f"{prompt}\n{param_text}"
        
        # Enhanced system instructions to use KB context as format reference
        system_prompt = """You are an expert proposal writer helping create enterprise RFP responses.

CRITICAL INSTRUCTIONS:
1. If Reference Materials from Knowledge Base are provided above, you MUST follow their exact format, structure, and writing style
2. Use specific facts, metrics, and details from the reference materials - do NOT invent or use placeholder text
3. If a previous proposal template is provided, match its professional structure exactly
4. Replace any placeholders with actual content - NEVER output [bracketed placeholders]
5. Write in formal, confident consulting-grade English
6. Include specific numbers, dates, and concrete details when available from context

Generate the content now, following the reference format precisely:"""
        
        return f"{system_prompt}\n\n---\n\n{prompt}"

    
    def _calculate_confidence(
        self,
        context: List[Dict],
        inputs: Dict,
        section_type: str
    ) -> float:
        """Calculate confidence score based on available information"""
        score = 0.5  # Base score
        
        # Boost for context availability
        if context:
            context_boost = min(len(context) * 0.1, 0.3)  # Up to 0.3 boost
            score += context_boost
            
            # Check context relevance scores
            avg_relevance = sum(c.get('score', 0.5) for c in context) / len(context)
            score += avg_relevance * 0.1
        
        # Check if all required inputs are provided
        missing_inputs = [k for k, v in inputs.items() if not v]
        if not missing_inputs:
            score += 0.1
        else:
            score -= len(missing_inputs) * 0.05
        
        # Cap between 0.1 and 0.95
        return max(0.1, min(0.95, score))
    
    def _extract_sources(self, context: List[Dict]) -> List[Dict]:
        """Extract source citations from context items"""
        sources = []
        for item in context[:5]:
            sources.append({
                'title': item.get('title', 'Unknown Source'),
                'relevance': item.get('score', 0.5),
                'snippet': (item.get('content', '')[:150] + '...') if item.get('content') else '',
                'item_id': item.get('item_id') or item.get('id'),
            })
        return sources
    
    def _detect_flags(
        self,
        content: str,
        context: List[Dict],
        inputs: Dict,
        section_type: str
    ) -> List[str]:
        """Detect potential issues requiring review"""
        flags = []
        
        # Check for missing inputs
        missing = [k for k, v in inputs.items() if not v]
        if missing:
            flags.append(f'missing_inputs:{",".join(missing)}')
        
        # Check for low context
        if not context or len(context) < 2:
            flags.append('low_context')
        
        # Check for placeholder text
        if '{{' in content and '}}' in content:
            flags.append('unresolved_placeholders')
        
        # Check for common issues
        low_confidence_phrases = [
            'I don\'t have information',
            'unable to find',
            'not specified',
            'unclear',
            'need more details',
        ]
        for phrase in low_confidence_phrases:
            if phrase.lower() in content.lower():
                flags.append('uncertain_content')
                break
        
        return flags
    
    def regenerate_with_feedback(
        self,
        original_content: str,
        feedback: str,
        section_type_slug: str,
        context: List[Dict]
    ) -> Dict:
        """Regenerate content incorporating user feedback"""
        
        prompt = f"""Original content:
{original_content}

User feedback for improvement:
{feedback}

Please rewrite the content addressing the feedback while maintaining professional quality."""
        
        return self.generate_section_content(
            section_type_slug=section_type_slug,
            prompt_template=prompt,
            inputs={},
            context=context,
        )
    
    def chat(self, messages: List[Dict]) -> str:
        """
        Chat-style conversation for section content generation.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
        
        Returns:
            AI response text
        """
        # Build the conversation as a single prompt
        conversation_text = ""
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role == 'system':
                conversation_text += f"System Instructions:\n{content}\n\n"
            elif role == 'user':
                conversation_text += f"User: {content}\n\n"
            elif role == 'assistant':
                conversation_text += f"Assistant: {content}\n\n"
        
        conversation_text += "Assistant: "
        
        try:
            return self._generate(conversation_text)
        except Exception as e:
            print(f"Error in chat: {e}")
            return f"Error generating response: {str(e)}"


# Singleton instance cache
_section_generators: Dict[int, SectionGenerationService] = {}

def get_section_generator(org_id: int = None) -> SectionGenerationService:
    """
    Get or create the section generation service for an organization.
    
    Args:
        org_id: Organization ID for database config lookup
        
    Returns:
        SectionGenerationService instance
    """
    global _section_generators
    
    if org_id is None:
        # Return a generator without org-specific config
        if 0 not in _section_generators:
            _section_generators[0] = SectionGenerationService(org_id=None)
        return _section_generators[0]
    
    if org_id not in _section_generators:
        _section_generators[org_id] = SectionGenerationService(org_id=org_id)
    return _section_generators[org_id]
