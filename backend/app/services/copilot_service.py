"""
Co-Pilot Chat Service

Provides general-purpose AI chat functionality using configured LLM providers.
"""
import logging
from typing import List, Dict, Any, Optional
from app.agents.config import AgentConfig

logger = logging.getLogger(__name__)


class CoPilotService:
    """Service for Co-Pilot chat functionality."""
    
    SYSTEM_PROMPTS = {
        'general': """You are a helpful AI assistant. Answer questions accurately and helpfully.
When asked for code, provide complete, working examples with proper syntax highlighting.
Format responses with proper markdown when appropriate.
Be concise but thorough.""",
        
        'agents': """You are an expert RFP (Request for Proposal) assistant.
Help users understand RFP requirements, generate responses, and ensure compliance.
Use markdown formatting for clear, professional responses.
Provide specific, actionable advice.""",
    }
    
    AGENT_PROMPTS = {
        'general-ai': 'You are a helpful general AI assistant. Answer any question clearly and helpfully. When asked for code, provide complete examples.',
        'rfp-analyzer': 'You are an RFP analysis expert. Extract and explain requirements from RFP documents.',
        'question-extractor': 'You extract and list questions from RFP documents in a structured format.',
        'answer-generator': 'You generate professional responses to RFP questions using best practices.',
        'compliance-checker': 'You verify if responses meet RFP requirements and flag any gaps.',
        'knowledge-search': 'You search knowledge bases and summarize relevant information.',
        'document-reader': 'You read and summarize document content clearly.',
        'proposal-writer': 'You write professional, persuasive proposal content.',
        'executive-summary': 'You create concise executive summaries highlighting key points.',
        'competitor-analyzer': 'You analyze competitive positioning and differentiation strategies.',
        'risk-assessor': 'You identify project risks and suggest mitigation strategies.',
        'pricing-advisor': 'You help with pricing strategies and cost breakdowns.',
    }
    
    def __init__(self, organization_id: Optional[int] = None):
        """Initialize Co-Pilot service with optional organization context."""
        self.organization_id = organization_id
        self._config = None
    
    def _get_config(self) -> AgentConfig:
        """Get configured agent config."""
        if self._config is None:
            self._config = AgentConfig(
                org_id=self.organization_id,
                agent_type='copilot'
            )
        return self._config
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        mode: str = 'general',
        agent_id: Optional[str] = None,
        use_web_search: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate a chat response.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            mode: 'general' or 'agents' 
            agent_id: Specific agent to use (optional)
            use_web_search: Enable web search (not yet implemented)
            
        Returns:
            Dict with 'content', 'agent', 'success'
        """
        try:
            config = self._get_config()
            llm = config.llm_provider
            
            if not llm:
                return {
                    'success': False,
                    'error': 'No LLM provider configured. Please configure AI settings.',
                    'content': 'I apologize, but the AI service is not configured. Please contact your administrator.',
                    'agent': None
                }
            
            # Build system prompt
            if agent_id and agent_id in self.AGENT_PROMPTS:
                system_prompt = self.AGENT_PROMPTS[agent_id]
                agent_name = agent_id.replace('-', ' ').title()
            else:
                system_prompt = self.SYSTEM_PROMPTS.get(mode, self.SYSTEM_PROMPTS['general'])
                agent_name = 'General AI' if mode == 'general' else 'RFP Assistant'
            
            # Prepare messages with system prompt
            full_messages = [
                {"role": "system", "content": system_prompt}
            ] + messages
            
            # Generate response using LLM provider
            response = llm.generate_chat(full_messages, **kwargs)
            
            return {
                'success': True,
                'content': response,
                'agent': agent_name,
                'mode': mode
            }
            
        except Exception as e:
            logger.error(f"CoPilot chat error: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'content': f'I encountered an error: {str(e)}. Please try again.',
                'agent': None
            }
    
    def get_available_agents(self) -> List[Dict[str, Any]]:
        """Get list of available agents."""
        agents = []
        for agent_id, description in self.AGENT_PROMPTS.items():
            agents.append({
                'id': agent_id,
                'name': agent_id.replace('-', ' ').title(),
                'description': description[:100],
            })
        return agents
