"""
Seed Default LiteLLM Configurations

Creates default LiteLLM AI configuration for existing organizations.
All configuration is stored in database - no environment variables needed.

Usage:
    python seed_litellm_configs.py

Or specify custom values:
    python seed_litellm_configs.py --base-url https://litellm.tarento.dev --api-key YOUR_KEY
"""
import argparse
import sys
from app import create_app
from app.models import Organization, AgentAIConfig
from app.extensions import db


# Default LiteLLM configuration
DEFAULT_CONFIG = {
    'base_url': 'https://litellm.tarento.dev',
    'provider': 'litellm',
    'default_model': 'gemini-flash',  # Default for most agents
    'temperature': 0.7,
    'max_tokens': 4096,
}

# Agent-specific model recommendations
AGENT_MODELS = {
    'default': 'gemini-flash',           # Default fallback
    'answer_generation': 'gemini-pro',    # Most capable for answers
    'question_extraction': 'gemini-flash', # Fast for extraction
    'document_analysis': 'gemini-flash',  # Fast for document parsing
    'knowledge_base': 'gemini-flash',     # Fast for retrieval
    'answer_validation': 'gemini-pro',    # Capable for validation
    'compliance_checking': 'gemini-pro',  # Accurate for compliance
    'quality_review': 'gemini-pro',       # Quality needs capability
    'clarification': 'gemini-flash',      # Fast for clarifications
    'diagram_generation': 'gemini-pro',   # Complex output
    'ppt_generation': 'gemini-pro',       # Complex output
    'section_mapping': 'gemini-flash',    # Fast for mapping
    'feedback_learning': 'gemini-flash-lite',  # Simple updates
}


def seed_litellm_configs(api_key: str = None, base_url: str = None, setup_all_agents: bool = False):
    """
    Create default LiteLLM configurations for all organizations.
    
    Args:
        api_key: LiteLLM API key (required)
        base_url: LiteLLM proxy URL
        setup_all_agents: If True, create configs for all agents. Otherwise just default.
    """
    app = create_app()
    
    with app.app_context():
        organizations = Organization.query.all()
        
        if not organizations:
            print("❌ No organizations found in database!")
            print("   Create an organization first, then run this script.")
            return False
        
        print(f"Found {len(organizations)} organization(s)")
        print(f"LiteLLM Base URL: {base_url or DEFAULT_CONFIG['base_url']}")
        print(f"API Key: {'***' + api_key[-4:] if api_key else 'Not provided'}")
        print()
        
        for org in organizations:
            print(f"\n📁 Organization: {org.name} (ID: {org.id})")
            
            # Determine which agents to configure
            agents_to_setup = AGENT_MODELS.keys() if setup_all_agents else ['default']
            
            for agent_type in agents_to_setup:
                # Check if config already exists
                existing = AgentAIConfig.query.filter_by(
                    organization_id=org.id,
                    agent_type=agent_type,
                    is_active=True
                ).first()
                
                if existing:
                    print(f"   ✓ {agent_type}: Already configured ({existing.provider}/{existing.model})")
                    continue
                
                # Create new config
                model = AGENT_MODELS.get(agent_type, DEFAULT_CONFIG['default_model'])
                
                config = AgentAIConfig(
                    organization_id=org.id,
                    agent_type=agent_type,
                    provider=DEFAULT_CONFIG['provider'],
                    model=model,
                    base_url=base_url or DEFAULT_CONFIG['base_url'],
                    temperature=DEFAULT_CONFIG['temperature'],
                    max_tokens=DEFAULT_CONFIG['max_tokens'],
                    use_default_key=(agent_type != 'default'),  # Non-default agents use default's key
                    is_active=True
                )
                
                # Set API key for default config
                if agent_type == 'default' and api_key:
                    config.set_api_key(api_key)
                
                db.session.add(config)
                print(f"   + {agent_type}: Created with model '{model}'")
            
            db.session.commit()
        
        print("\n" + "="*50)
        print("✅ LiteLLM configurations seeded successfully!")
        print("="*50)
        
        # Summary
        total_configs = AgentAIConfig.query.filter_by(
            provider='litellm',
            is_active=True
        ).count()
        print(f"\nTotal LiteLLM configs in database: {total_configs}")
        
        return True


def main():
    parser = argparse.ArgumentParser(
        description='Seed LiteLLM configurations for all organizations'
    )
    parser.add_argument(
        '--api-key', '-k',
        help='LiteLLM API key (required for new setups)',
        default=None
    )
    parser.add_argument(
        '--base-url', '-u',
        help=f'LiteLLM proxy URL (default: {DEFAULT_CONFIG["base_url"]})',
        default=DEFAULT_CONFIG['base_url']
    )
    parser.add_argument(
        '--all-agents', '-a',
        action='store_true',
        help='Setup all agents with recommended models (otherwise just default)'
    )
    
    args = parser.parse_args()
    
    if not args.api_key:
        print("⚠️  No API key provided. Configs will be created without keys.")
        print("   You can update API keys later via the UI or API.")
        response = input("Continue? [y/N]: ")
        if response.lower() != 'y':
            print("Aborted.")
            sys.exit(0)
    
    success = seed_litellm_configs(
        api_key=args.api_key,
        base_url=args.base_url,
        setup_all_agents=args.all_agents
    )
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
