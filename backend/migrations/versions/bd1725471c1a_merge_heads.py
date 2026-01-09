"""merge_heads

Revision ID: bd1725471c1a
Revises: add_capability_led, accelerator_refactor_001
Create Date: 2026-01-09 10:08:04.184413

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bd1725471c1a'
down_revision = ('add_capability_led', 'accelerator_refactor_001')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
