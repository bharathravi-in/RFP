"""Merge heads

Revision ID: 503d186380ad
Revises: add_feedback_learning, litellm_config_001
Create Date: 2025-12-23 22:58:45.824965

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '503d186380ad'
down_revision = ('add_feedback_learning', 'litellm_config_001')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
