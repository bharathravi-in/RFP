"""Add capability_led proposal support

Revision ID: add_capability_led
Revises: add_case_studies
Create Date: 2026-01-09
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_capability_led'
down_revision = 'add_case_studies'
branch_labels = None
depends_on = None


def upgrade():
    # Add proposal_type to projects table
    op.add_column('projects', sa.Column('proposal_type', sa.String(30), nullable=True, server_default='rfp_upload'))
    
    # Create capability_contexts table
    op.create_table('capability_contexts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        # Client Info
        sa.Column('client_product', sa.Text(), nullable=True),
        sa.Column('client_domain', sa.String(100), nullable=True),
        sa.Column('client_challenges', sa.JSON(), nullable=True),
        sa.Column('client_goals', sa.JSON(), nullable=True),
        sa.Column('meeting_notes', sa.Text(), nullable=True),
        sa.Column('meeting_date', sa.Date(), nullable=True),
        sa.Column('key_stakeholders', sa.JSON(), nullable=True),
        # Processed Context
        sa.Column('structured_context', sa.JSON(), nullable=True),
        sa.Column('identified_needs', sa.JSON(), nullable=True),
        sa.Column('decision_criteria', sa.JSON(), nullable=True),
        # Alignment
        sa.Column('alignment_mapping', sa.JSON(), nullable=True),
        sa.Column('alignment_score', sa.Float(), nullable=True),
        # Footprints
        sa.Column('selected_case_studies', sa.JSON(), nullable=True),
        sa.Column('selected_success_stories', sa.JSON(), nullable=True),
        sa.Column('selected_testimonials', sa.JSON(), nullable=True),
        sa.Column('highlight_metrics', sa.JSON(), nullable=True),
        # Win-Win
        sa.Column('client_value_props', sa.JSON(), nullable=True),
        sa.Column('vendor_value_props', sa.JSON(), nullable=True),
        sa.Column('partnership_narrative', sa.Text(), nullable=True),
        # Generated
        sa.Column('generated_sections', sa.JSON(), nullable=True),
        sa.Column('generation_status', sa.String(30), nullable=True, server_default='pending'),
        # Metadata
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id')
    )
    
    # Create index for quick lookups
    op.create_index('ix_capability_contexts_project_id', 'capability_contexts', ['project_id'])


def downgrade():
    op.drop_index('ix_capability_contexts_project_id')
    op.drop_table('capability_contexts')
    op.drop_column('projects', 'proposal_type')
