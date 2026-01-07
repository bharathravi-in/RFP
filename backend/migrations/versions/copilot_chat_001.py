"""Add copilot chat tables

Revision ID: copilot_chat_001
Revises: 
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'copilot_chat_001'
down_revision = 'bc723b471cf4'  # Link to existing head
branch_labels = None
depends_on = None


def upgrade():
    # Create copilot_sessions table
    op.create_table(
        'copilot_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True, default='New Chat'),
        sa.Column('mode', sa.String(length=20), nullable=True, default='general'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_copilot_sessions_user_id'), 'copilot_sessions', ['user_id'], unique=False)

    # Create copilot_messages table
    op.create_table(
        'copilot_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('agent_name', sa.String(length=100), nullable=True),
        sa.Column('agent_icon', sa.String(length=10), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, default='complete'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['copilot_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_copilot_messages_session_id'), 'copilot_messages', ['session_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_copilot_messages_session_id'), table_name='copilot_messages')
    op.drop_table('copilot_messages')
    op.drop_index(op.f('ix_copilot_sessions_user_id'), table_name='copilot_sessions')
    op.drop_table('copilot_sessions')
