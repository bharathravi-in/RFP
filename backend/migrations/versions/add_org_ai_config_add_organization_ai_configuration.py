"""Add organization AI configuration

Revision ID: add_org_ai_config
Revises: f722678701f3
Create Date: 2025-12-17 21:37:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_org_ai_config'
down_revision = 'f722678701f3'
branch_labels = None
depends_on = None


def upgrade():
    # Create organization_ai_configs table
    op.create_table('organization_ai_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('embedding_provider', sa.String(length=50), nullable=True),
        sa.Column('embedding_model', sa.String(length=100), nullable=True),
        sa.Column('embedding_api_key', sa.Text(), nullable=True),
        sa.Column('embedding_api_endpoint', sa.String(length=255), nullable=True),
        sa.Column('embedding_dimension', sa.Integer(), nullable=True),
        sa.Column('llm_provider', sa.String(length=50), nullable=True),
        sa.Column('llm_model', sa.String(length=100), nullable=True),
        sa.Column('llm_api_key', sa.Text(), nullable=True),
        sa.Column('llm_api_endpoint', sa.String(length=255), nullable=True),
        sa.Column('config_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('organization_ai_configs')
