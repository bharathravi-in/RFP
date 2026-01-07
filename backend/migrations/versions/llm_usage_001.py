"""Add LLM Usage tracking table

Revision ID: llm_usage_001
Revises: 
Create Date: 2025-12-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'llm_usage_001'
down_revision = 'd60ebc29806f'  # Chain from add_global_folders_and_project_linking
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'llm_usage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('agent_type', sa.String(length=50), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), default=0),
        sa.Column('completion_tokens', sa.Integer(), default=0),
        sa.Column('total_tokens', sa.Integer(), default=0),
        sa.Column('estimated_cost', sa.Numeric(precision=10, scale=6), default=0),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('success', sa.Boolean(), default=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        # Note: FK constraints removed to avoid dependency issues during migration
        # Application layer enforces these relationships
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index('ix_llm_usage_org_id', 'llm_usage', ['org_id'], unique=False)
    op.create_index('ix_llm_usage_agent_type', 'llm_usage', ['agent_type'], unique=False)
    op.create_index('ix_llm_usage_created_at', 'llm_usage', ['created_at'], unique=False)


def downgrade():
    op.drop_index('ix_llm_usage_created_at', table_name='llm_usage')
    op.drop_index('ix_llm_usage_agent_type', table_name='llm_usage')
    op.drop_index('ix_llm_usage_org_id', table_name='llm_usage')
    op.drop_table('llm_usage')
