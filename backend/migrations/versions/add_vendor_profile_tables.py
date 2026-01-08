"""add vendor profile tables

Revision ID: vendor_profile_001
Revises: 
Create Date: 2026-01-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'vendor_profile_001'
down_revision = None  # Update this to your latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Create vendor_profiles table
    op.create_table('vendor_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=True),
        sa.Column('registration_country', sa.String(length=100), nullable=True),
        sa.Column('years_in_business', sa.Integer(), nullable=True),
        sa.Column('company_description', sa.Text(), nullable=True),
        sa.Column('industries_served', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('certifications', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('employee_count_range', sa.String(length=50), nullable=True),
        sa.Column('annual_revenue_range', sa.String(length=50), nullable=True),
        sa.Column('headquarters_location', sa.String(length=255), nullable=True),
        sa.Column('office_locations', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('mission_statement', sa.Text(), nullable=True),
        sa.Column('value_proposition', sa.Text(), nullable=True),
        sa.Column('key_differentiators', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('source_document_path', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id')
    )

    # Create vendor_clients table
    op.create_table('vendor_clients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_profile_id', sa.Integer(), nullable=False),
        sa.Column('client_name', sa.String(length=255), nullable=False),
        sa.Column('client_industry', sa.String(length=100), nullable=True),
        sa.Column('client_size', sa.String(length=50), nullable=True),
        sa.Column('client_location', sa.String(length=255), nullable=True),
        sa.Column('client_type', sa.String(length=50), nullable=True),
        sa.Column('relationship_status', sa.String(length=50), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('project_count', sa.Integer(), nullable=True),
        sa.Column('services_provided', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('technologies_used', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('project_value_range', sa.String(length=50), nullable=True),
        sa.Column('is_reference_available', sa.Boolean(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('anonymize_name', sa.Boolean(), nullable=True),
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['vendor_profile_id'], ['vendor_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create vendor_success_stories table
    op.create_table('vendor_success_stories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_profile_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('client_name', sa.String(length=255), nullable=True),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('client_size', sa.String(length=50), nullable=True),
        sa.Column('challenge', sa.Text(), nullable=True),
        sa.Column('solution', sa.Text(), nullable=True),
        sa.Column('impact', sa.Text(), nullable=True),
        sa.Column('impact_metrics', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('technologies_used', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('methodologies', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('project_duration_months', sa.Integer(), nullable=True),
        sa.Column('team_size', sa.Integer(), nullable=True),
        sa.Column('budget_range', sa.String(length=50), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('services_provided', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('industry_vertical', sa.String(length=100), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('is_featured', sa.Boolean(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('document_url', sa.String(length=500), nullable=True),
        sa.Column('images', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['vendor_clients.id'], ),
        sa.ForeignKeyConstraint(['vendor_profile_id'], ['vendor_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create vendor_capabilities table
    op.create_table('vendor_capabilities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_profile_id', sa.Integer(), nullable=False),
        sa.Column('capability_name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('years_of_experience', sa.Integer(), nullable=True),
        sa.Column('expertise_level', sa.String(length=50), nullable=True),
        sa.Column('key_projects_count', sa.Integer(), nullable=True),
        sa.Column('technologies', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('tools', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('certifications', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('compliance_standards', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('success_rate', sa.Float(), nullable=True),
        sa.Column('client_satisfaction', sa.Float(), nullable=True),
        sa.Column('delivery_success', sa.Float(), nullable=True),
        sa.Column('team_size', sa.Integer(), nullable=True),
        sa.Column('availability', sa.String(length=50), nullable=True),
        sa.Column('service_locations', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('languages_supported', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_core_capability', sa.Boolean(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['vendor_profile_id'], ['vendor_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create vendor_testimonials table
    op.create_table('vendor_testimonials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_profile_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=True),
        sa.Column('testimonial_text', sa.Text(), nullable=False),
        sa.Column('client_name', sa.String(length=255), nullable=True),
        sa.Column('client_designation', sa.String(length=255), nullable=True),
        sa.Column('client_company', sa.String(length=255), nullable=True),
        sa.Column('client_industry', sa.String(length=100), nullable=True),
        sa.Column('rating', sa.Float(), nullable=True),
        sa.Column('project_category', sa.String(length=100), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=True),
        sa.Column('verification_method', sa.String(length=50), nullable=True),
        sa.Column('verification_date', sa.DateTime(), nullable=True),
        sa.Column('is_featured', sa.Boolean(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('source_platform', sa.String(length=100), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('date_provided', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['vendor_clients.id'], ),
        sa.ForeignKeyConstraint(['vendor_profile_id'], ['vendor_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('vendor_testimonials')
    op.drop_table('vendor_capabilities')
    op.drop_table('vendor_success_stories')
    op.drop_table('vendor_clients')
    op.drop_table('vendor_profiles')
