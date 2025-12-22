"""Merge heads for comments

Revision ID: bab7b59859b8
Revises: add_notifications, d1bb3e6a74b3
Create Date: 2025-12-22 17:24:07.724664

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bab7b59859b8'
down_revision = ('add_notifications', 'd1bb3e6a74b3')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
