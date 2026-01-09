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
        # Debug: log context received
        print(f"[SOURCES DEBUG] generate_section_content received {len(context)} context items")
        for i, item in enumerate(context[:5]):
            print(f"[SOURCES DEBUG]   Context {i}: title={item.get('title', 'N/A')}, has_content={bool(item.get('content') or item.get('content_preview'))}")
        
        # Determine generation source type
        if context and len(context) >= 2:
            # Good KB coverage
            generation_source = 'kb_sourced'
            content_warning = None
        elif context and len(context) == 1:
            # Limited KB coverage
            generation_source = 'partial_kb'
            content_warning = 'Limited knowledge base content found. Consider adding more relevant documents to improve accuracy.'
        else:
            # No KB sources - generic AI generation
            generation_source = 'generic_ai'
            content_warning = 'No matching knowledge base content found. This is AI-generated from general knowledge. Consider: 1) Adding relevant documents to Knowledge Base, or 2) Using AI to generate knowledge from web sources.'
        
        print(f"[GENERATION SOURCE] {generation_source}: {len(context)} KB sources found")
        
        # Prepare the prompt
        prompt = self._prepare_prompt(prompt_template, inputs, context, generation_params)
        
        try:
            # Generate content
            content = self._generate(prompt)
            
            # Calculate confidence based on context availability
            confidence_score = self._calculate_confidence(context, inputs, section_type_slug)
            
            # Extract sources from context
            sources = self._extract_sources(context)
            print(f"[SOURCES DEBUG] Extracted {len(sources)} sources from context")
            for s in sources:
                print(f"[SOURCES DEBUG]   Source: {s.get('title', 'Unknown')}, relevance={s.get('relevance', 0)}")
            
            # Detect any flags/warnings
            flags = self._detect_flags(content, context, inputs, section_type_slug)
            
            # Add low_kb_coverage flag if generic
            if generation_source in ('generic_ai', 'partial_kb'):
                flags.append('low_kb_coverage')
            
            return {
                'content': content,
                'confidence_score': confidence_score,
                'sources': sources,
                'flags': flags,
                'generation_source': generation_source,  # NEW: kb_sourced | partial_kb | generic_ai
                'content_warning': content_warning,      # NEW: Warning message for user
            }
            
        except Exception as e:
            print(f"Error generating section content: {e}")
            return {
                'content': f'Error generating content: {str(e)}',
                'confidence_score': 0.0,
                'sources': [],
                'flags': ['generation_error'],
                'generation_source': 'error',
                'content_warning': 'Generation failed. Please try again.',
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
            
            # WIN THEMES INTEGRATION (Phase 2 Enhancement)
            if params.get('win_themes'):
                win_themes = params['win_themes']
                param_text += "\n\n---\n## WIN THEMES - Incorporate these differentiators naturally:\n"
                for i, theme in enumerate(win_themes, 1):
                    theme_title = theme.get('theme', 'Key Advantage')
                    theme_desc = theme.get('description', '')
                    param_text += f"\n### Theme {i}: {theme_title}"
                    if theme_desc:
                        param_text += f"\n{theme_desc}"
                    
                    talking_points = theme.get('talking_points', [])
                    if talking_points and isinstance(talking_points, list):
                        param_text += "\nKey Points:"
                        for point in talking_points[:3]:
                            param_text += f"\n  • {point}"
                    param_text += "\n"
                param_text += "\nNaturally weave these themes into your response without explicitly mentioning 'win theme'."
            
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
        """
        Calculate confidence score based on available information.
        
        Score factors:
        - Base score: 0.4 (no context = low confidence)
        - Context availability: up to 0.35 (based on quantity and quality)
        - Source citations: up to 0.15 (based on relevance scores)
        - Input completeness: up to 0.10
        
        Target: 80%+ when good KB context exists
        """
        score = 0.4  # Base score (was 0.5 - lowered so lack of KB context hurts more)
        
        print(f"[CONFIDENCE DEBUG] Starting calculation for {section_type}")
        print(f"[CONFIDENCE DEBUG] Context items received: {len(context)}")
        
        # Boost for context availability (UP TO 0.35)
        if context:
            num_sources = len(context)
            # More sources = higher confidence (0.07 per source, max 0.35)
            quantity_boost = min(num_sources * 0.07, 0.35)
            score += quantity_boost
            print(f"[CONFIDENCE DEBUG] Quantity boost: {quantity_boost} ({num_sources} sources)")
            
            # Check context relevance scores (UP TO 0.15)
            relevance_scores = [c.get('score', c.get('relevance', 0.5)) for c in context]
            if relevance_scores:
                avg_relevance = sum(relevance_scores) / len(relevance_scores)
                relevance_boost = avg_relevance * 0.15
                score += relevance_boost
                print(f"[CONFIDENCE DEBUG] Relevance boost: {relevance_boost} (avg={avg_relevance:.2f})")
        else:
            print("[CONFIDENCE DEBUG] NO CONTEXT - check why Qdrant search returned empty")
        
        # Check if all required inputs are provided (UP TO 0.10)
        missing_inputs = [k for k, v in inputs.items() if not v]
        if not missing_inputs:
            score += 0.10
            print("[CONFIDENCE DEBUG] All inputs complete: +0.10")
        else:
            penalty = len(missing_inputs) * 0.03
            score -= penalty
            print(f"[CONFIDENCE DEBUG] Missing inputs {missing_inputs}: -{penalty}")
        
        final_score = max(0.1, min(0.95, score))
        print(f"[CONFIDENCE DEBUG] Final confidence: {final_score:.2f}")
        
        return final_score
    
    def _extract_sources(self, context: List[Dict]) -> List[Dict]:
        """Extract source citations from context items"""
        sources = []
        for item in context[:5]:
            # Handle different field names from Qdrant vs direct knowledge items
            title = item.get('title') or item.get('metadata', {}).get('title', 'Unknown Source')
            content = item.get('content') or item.get('content_preview', '')
            relevance = item.get('score') or item.get('relevance', 0.5)
            item_id = item.get('item_id') or item.get('id')
            
            sources.append({
                'title': title,
                'relevance': relevance,
                'snippet': (content[:150] + '...') if len(content) > 150 else content,
                'item_id': item_id,
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
