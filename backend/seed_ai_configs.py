"""
Seed Default AI Configurations

Creates default AI configuration for existing organizations using Google AI.
"""
from app import create_app
from app.models import Organization, OrganizationAIConfig
from app.extensions import db
import os


def seed_default_ai_configs():
    """Create default AI configurations for all organizations."""
    app = create_app()
    
    with app.app_context():
        # Get all organizations
        organizations = Organization.query.all()
        
        print(f"Found {len(organizations)} organizations")
        
        for org in organizations:
            # Check if config already exists
            existing_config = OrganizationAIConfig.query.filter_by(
                organization_id=org.id,
                is_active=True
            ).first()
            
            if existing_config:
                print(f"  ✓ Org '{org.name}' already has AI config")
                continue
            
            # Create default Google AI config
            config = OrganizationAIConfig(
                organization_id=org.id,
                embedding_provider='google',
                embedding_model='models/text-embedding-004',
                embedding_dimension=768,
                llm_provider='google',
                llm_model='gemini-1.5-pro',
                is_active=True
            )
            
            # Use system Google API key as default
            google_api_key = os.getenv('GOOGLE_API_KEY')
            if google_api_key:
                config.set_embedding_key(google_api_key)
                config.set_llm_key(google_api_key)
            
            db.session.add(config)
            print(f"  + Created default config for org '{org.name}'")
        
        db.session.commit()
        print("\n✅ Default AI configurations seeded successfully!")


if __name__ == '__main__':
    seed_default_ai_configs()
