"""Add case_studies table

Revision ID: add_case_studies
Revises: add_sprint_timeline
Create Date: 2026-01-09
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_case_studies'
down_revision = 'add_sprint_timeline'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('case_studies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('client_name', sa.String(length=255), nullable=True),
        sa.Column('client_industry', sa.String(length=100), nullable=True),
        sa.Column('client_size', sa.String(length=50), nullable=True),
        sa.Column('client_geography', sa.String(length=100), nullable=True),
        sa.Column('is_client_public', sa.Boolean(), nullable=True, default=False),
        sa.Column('challenge', sa.Text(), nullable=True),
        sa.Column('solution', sa.Text(), nullable=True),
        sa.Column('approach', sa.JSON(), nullable=True),
        sa.Column('results', sa.JSON(), nullable=True),
        sa.Column('key_outcomes', sa.JSON(), nullable=True),
        sa.Column('technologies', sa.JSON(), nullable=True),
        sa.Column('services', sa.JSON(), nullable=True),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('project_type', sa.String(length=100), nullable=True),
        sa.Column('duration_months', sa.Integer(), nullable=True),
        sa.Column('team_size', sa.Integer(), nullable=True),
        sa.Column('project_value', sa.String(length=50), nullable=True),
        sa.Column('testimonial_text', sa.Text(), nullable=True),
        sa.Column('testimonial_author', sa.String(length=255), nullable=True),
        sa.Column('testimonial_role', sa.String(length=100), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=True, default=False),
        sa.Column('verified_by', sa.Integer(), nullable=True),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True, default='draft'),
        sa.Column('can_be_referenced', sa.Boolean(), nullable=True, default=True),
        sa.Column('reference_contact', sa.String(length=255), nullable=True),
        sa.Column('project_completion_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index('ix_case_studies_org_id', 'case_studies', ['organization_id'])
    op.create_index('ix_case_studies_industry', 'case_studies', ['industry'])
    op.create_index('ix_case_studies_status', 'case_studies', ['status'])


def downgrade():
    op.drop_index('ix_case_studies_status')
    op.drop_index('ix_case_studies_industry')
    op.drop_index('ix_case_studies_org_id')
    op.drop_table('case_studies')
