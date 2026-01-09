"""update vendor capabilities to accelerators

Revision ID: accelerator_refactor_001
Revises: add_case_studies
Create Date: 2026-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'accelerator_refactor_001'
down_revision = 'add_case_studies'
branch_labels = None
depends_on = None


def upgrade():
    """
    Update vendor_capabilities table to new accelerator schema.
    Removes old capability fields and adds new accelerator fields.
    """
    
    # Add new columns first
    op.add_column('vendor_capabilities', 
        sa.Column('organization_id', sa.Integer(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('technologies_used', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('use_cases', sa.Text(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('time_saved', sa.String(length=100), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('demo_link', sa.String(length=500), nullable=True))
    
    # Migrate data: copy technologies to technologies_used
    op.execute("""
        UPDATE vendor_capabilities 
        SET technologies_used = technologies,
            organization_id = (
                SELECT organization_id 
                FROM vendor_profiles 
                WHERE vendor_profiles.id = vendor_capabilities.vendor_profile_id
            )
        WHERE technologies IS NOT NULL
    """)
    
    # Make organization_id NOT NULL after populating
    op.alter_column('vendor_capabilities', 'organization_id', nullable=False)
    
    # Drop old columns
    op.drop_column('vendor_capabilities', 'languages_supported')
    op.drop_column('vendor_capabilities', 'service_locations')
    op.drop_column('vendor_capabilities', 'availability')
    op.drop_column('vendor_capabilities', 'team_size')
    op.drop_column('vendor_capabilities', 'delivery_success')
    op.drop_column('vendor_capabilities', 'client_satisfaction')
    op.drop_column('vendor_capabilities', 'success_rate')
    op.drop_column('vendor_capabilities', 'compliance_standards')
    op.drop_column('vendor_capabilities', 'certifications')
    op.drop_column('vendor_capabilities', 'tools')
    op.drop_column('vendor_capabilities', 'technologies')
    op.drop_column('vendor_capabilities', 'key_projects_count')
    op.drop_column('vendor_capabilities', 'expertise_level')
    op.drop_column('vendor_capabilities', 'years_of_experience')
    op.drop_column('vendor_capabilities', 'category')
    op.drop_column('vendor_capabilities', 'is_core_capability')


def downgrade():
    """
    Rollback to old capability schema.
    """
    
    # Add back old columns
    op.add_column('vendor_capabilities', 
        sa.Column('is_core_capability', sa.Boolean(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('category', sa.String(length=100), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('years_of_experience', sa.Integer(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('expertise_level', sa.String(length=50), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('key_projects_count', sa.Integer(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('technologies', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('tools', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('certifications', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('compliance_standards', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('success_rate', sa.Float(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('client_satisfaction', sa.Float(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('delivery_success', sa.Float(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('team_size', sa.Integer(), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('availability', sa.String(length=50), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('service_locations', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('vendor_capabilities', 
        sa.Column('languages_supported', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Migrate data back: copy technologies_used to technologies
    op.execute("""
        UPDATE vendor_capabilities 
        SET technologies = technologies_used
        WHERE technologies_used IS NOT NULL
    """)
    
    # Drop new columns
    op.drop_column('vendor_capabilities', 'demo_link')
    op.drop_column('vendor_capabilities', 'time_saved')
    op.drop_column('vendor_capabilities', 'use_cases')
    op.drop_column('vendor_capabilities', 'technologies_used')
    op.drop_column('vendor_capabilities', 'organization_id')
