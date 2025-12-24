"""Add LiteLLM configuration fields

Revision ID: litellm_config_001
Revises: f23acd0c2f4d
Create Date: 2025-12-23

Adds support for LiteLLM proxy configuration:
- base_url, temperature, max_tokens to agent_ai_configs
- litellm_base_url, litellm_api_key to organization_ai_configs
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'litellm_config_001'
down_revision = 'f23acd0c2f4d'
branch_labels = None
depends_on = None


def upgrade():
    # Add columns to agent_ai_configs
    with op.batch_alter_table('agent_ai_configs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('base_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('temperature', sa.Float(), nullable=True, server_default='0.7'))
        batch_op.add_column(sa.Column('max_tokens', sa.Integer(), nullable=True, server_default='4096'))
    
    # Add columns to organization_ai_configs
    with op.batch_alter_table('organization_ai_configs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('litellm_base_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('litellm_api_key', sa.Text(), nullable=True))


def downgrade():
    # Remove columns from organization_ai_configs
    with op.batch_alter_table('organization_ai_configs', schema=None) as batch_op:
        batch_op.drop_column('litellm_api_key')
        batch_op.drop_column('litellm_base_url')
    
    # Remove columns from agent_ai_configs
    with op.batch_alter_table('agent_ai_configs', schema=None) as batch_op:
        batch_op.drop_column('max_tokens')
        batch_op.drop_column('temperature')
        batch_op.drop_column('base_url')
