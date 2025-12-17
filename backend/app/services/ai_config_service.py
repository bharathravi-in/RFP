"""
AI Configuration Service

Service layer for managing agent-specific AI configurations.
"""
from app.models import AgentAIConfig, OrganizationAIConfig
from app.services.embedding_providers import EmbeddingProviderFactory
from app.extensions import db
import logging

logger = logging.getLogger(__name__)


class AIConfigService:
    """Service for managing AI configurations."""
    
    @staticmethod
    def get_agent_config(org_id: int, agent_type: str) -> AgentAIConfig:
        """
        Get configuration for specific agent.
        Falls back to 'default' if agent-specific config doesn't exist.
        
        Args:
            org_id: Organization ID
            agent_type: Agent type (e.g., 'rfp_analysis', 'ppt_generation')
            
        Returns:
            AgentAIConfig or None
        """
        # Try agent-specific config first
        config = AgentAIConfig.query.filter_by(
            organization_id=org_id,
            agent_type=agent_type,
            is_active=True
        ).first()
        
        if config:
            logger.debug(f"Found config for agent '{agent_type}' in org {org_id}")
            return config
        
        # Fallback to default config
        default_config = AgentAIConfig.query.filter_by(
            organization_id=org_id,
            agent_type='default',
            is_active=True
        ).first()
        
        if default_config:
            logger.debug(f"Using default config for agent '{agent_type}' in org {org_id}")
            return default_config
        
        logger.warning(f"No config found for agent '{agent_type}' in org {org_id}")
        return None
    
    @staticmethod
    def get_provider_for_agent(org_id: int, agent_type: str):
        """
        Get initialized provider instance for agent.
        
        Args:
            org_id: Organization ID
            agent_type: Agent type
            
        Returns:
            EmbeddingProvider instance or None
        """
        config = AIConfigService.get_agent_config(org_id, agent_type)
        
        if not config:
            return None
        
        try:
            api_key = config.get_api_key()
            if not api_key:
                logger.error(f"No API key available for agent '{agent_type}' in org {org_id}")
                return None
            
            provider = EmbeddingProviderFactory.create(
                provider=config.provider,
                api_key=api_key,
                model=config.model,  # Free text!
                endpoint=config.api_endpoint
            )
            
            logger.info(f"Initialized {config.provider} provider for agent '{agent_type}'")
            return provider
            
        except Exception as e:
            logger.error(f"Failed to initialize provider for agent '{agent_type}': {e}")
            return None
    
    @staticmethod
    def create_or_update_agent_config(org_id: int, agent_type: str, data: dict) -> AgentAIConfig:
        """
        Create or update agent configuration.
        
        Args:
            org_id: Organization ID
            agent_type: Agent type
            data: Configuration data
            
        Returns:
            AgentAIConfig instance
        """
        # Get existing config or create new
        config = AgentAIConfig.query.filter_by(
            organization_id=org_id,
            agent_type=agent_type,
            is_active=True
        ).first()
        
        if not config:
            config = AgentAIConfig(
                organization_id=org_id,
                agent_type=agent_type
            )
        
        # Update fields
        config.provider = data.get('provider', config.provider)
        config.model = data.get('model', config.model)  # Free text!
        config.api_endpoint = data.get('api_endpoint', config.api_endpoint)
        config.use_default_key = data.get('use_default_key', config.use_default_key)
        config.config_metadata = data.get('config_metadata', config.config_metadata or {})
        
        # Update API key if provided and not using default
        if 'api_key' in data and data['api_key'] and not config.use_default_key:
            config.set_api_key(data['api_key'])
        
        db.session.add(config)
        db.session.commit()
        
        logger.info(f"Updated config for agent '{agent_type}' in org {org_id}")
        return config
    
    @staticmethod
    def delete_agent_config(org_id: int, agent_type: str) -> bool:
        """
        Delete agent-specific configuration (will fallback to default).
        
        Args:
            org_id: Organization ID
            agent_type: Agent type
            
        Returns:
            True if deleted, False otherwise
        """
        if agent_type == 'default':
            logger.warning("Cannot delete default config")
            return False
        
        config = AgentAIConfig.query.filter_by(
            organization_id=org_id,
            agent_type=agent_type,
            is_active=True
        ).first()
        
        if config:
            config.is_active = False
            db.session.commit()
            logger.info(f"Deleted config for agent '{agent_type}' in org {org_id}")
            return True
        
        return False
    
    @staticmethod
    def list_agent_configs(org_id: int):
        """
        List all agent configurations for organization.
        
        Args:
            org_id: Organization ID
            
        Returns:
            List of AgentAIConfig instances
        """
        return AgentAIConfig.query.filter_by(
            organization_id=org_id,
            is_active=True
        ).all()
