"""Add document chat tables

Revision ID: document_chat_001
Create Date: 2025-12-27
"""
from alembic import op
import sqlalchemy as sa


revision = 'document_chat_001'
down_revision = 'llm_usage_001'  # Chain from llm_usage
branch_labels = None
depends_on = None


def upgrade():
    # Document chat sessions table
    op.create_table(
        'document_chat_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('key_points', sa.JSON(), nullable=True),
        sa.Column('suggestions', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        # Note: FK constraints removed to avoid dependency issues
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_document_chat_sessions_document_id', 'document_chat_sessions', ['document_id'])
    
    # Document chat messages table
    op.create_table(
        'document_chat_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('document_references', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        # Note: FK constraint removed
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_document_chat_messages_session_id', 'document_chat_messages', ['session_id'])


def downgrade():
    op.drop_index('ix_document_chat_messages_session_id', table_name='document_chat_messages')
    op.drop_table('document_chat_messages')
    op.drop_index('ix_document_chat_sessions_document_id', table_name='document_chat_sessions')
    op.drop_table('document_chat_sessions')
