"""Add diagrams and diagrams_generated_at to project_strategies

Revision ID: add_diagrams_to_strategy
Revises: 972bd06bdf52
Create Date: 2025-12-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_diagrams_to_strategy'
down_revision = '972bd06bdf52'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('project_strategies', schema=None) as batch_op:
        batch_op.add_column(sa.Column('diagrams', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('diagrams_generated_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('project_strategies', schema=None) as batch_op:
        batch_op.drop_column('diagrams_generated_at')
        batch_op.drop_column('diagrams')
