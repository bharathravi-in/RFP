"""Merge migration heads

Revision ID: 7160f51b14f5
Revises: add_knowledge_item_id, vendor_profile_001
Create Date: 2026-01-08 14:24:26.922131

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7160f51b14f5'
down_revision = ('add_knowledge_item_id', 'vendor_profile_001')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
