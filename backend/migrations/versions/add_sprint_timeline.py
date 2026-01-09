"""Add sprint_timeline to ProjectStrategy

Revision ID: add_sprint_timeline
Revises: 7160f51b14f5
Create Date: 2026-01-09
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_sprint_timeline'
down_revision = '7160f51b14f5'
branch_labels = None
depends_on = None


def upgrade():
    # Add sprint_timeline column to project_strategies table
    op.add_column('project_strategies', sa.Column('sprint_timeline', sa.JSON(), nullable=True))
    op.add_column('project_strategies', sa.Column('sprint_timeline_generated_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('project_strategies', 'sprint_timeline_generated_at')
    op.drop_column('project_strategies', 'sprint_timeline')
