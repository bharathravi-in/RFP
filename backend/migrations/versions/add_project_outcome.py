"""add project outcome fields

Revision ID: add_project_outcome
Revises: 
Create Date: 2024-12-22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_project_outcome'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add project outcome tracking fields
    op.add_column('projects', sa.Column('outcome', sa.String(20), nullable=True, server_default='pending'))
    op.add_column('projects', sa.Column('outcome_date', sa.DateTime(), nullable=True))
    op.add_column('projects', sa.Column('outcome_notes', sa.Text(), nullable=True))
    op.add_column('projects', sa.Column('contract_value', sa.Float(), nullable=True))
    op.add_column('projects', sa.Column('loss_reason', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('projects', 'loss_reason')
    op.drop_column('projects', 'contract_value')
    op.drop_column('projects', 'outcome_notes')
    op.drop_column('projects', 'outcome_date')
    op.drop_column('projects', 'outcome')
