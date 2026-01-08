"""add knowledge_item_id to document_chat_sessions

Revision ID: add_knowledge_item_id
Revises: ff4310ddba62
Create Date: 2026-01-07

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_knowledge_item_id'
down_revision = 'ff4310ddba62'  # Chains from the previous head
branch_labels = None
depends_on = None


def upgrade():
    # Add knowledge_item_id column
    op.add_column('document_chat_sessions',
        sa.Column('knowledge_item_id', sa.Integer(), nullable=True)
    )
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_chat_sessions_knowledge_item',
        'document_chat_sessions', 'knowledge_items',
        ['knowledge_item_id'], ['id']
    )
    
    # Create index for knowledge_item_id
    op.create_index(
        'ix_document_chat_sessions_knowledge_item_id',
        'document_chat_sessions',
        ['knowledge_item_id']
    )
    
    # Make document_id nullable (alter existing constraint)
    op.alter_column('document_chat_sessions', 'document_id',
        existing_type=sa.Integer(),
        nullable=True
    )


def downgrade():
    # Make document_id NOT NULL again
    op.alter_column('document_chat_sessions', 'document_id',
        existing_type=sa.Integer(),
        nullable=False
    )
    
    # Drop index
    op.drop_index('ix_document_chat_sessions_knowledge_item_id', 'document_chat_sessions')
    
    # Drop foreign key
    op.drop_constraint('fk_chat_sessions_knowledge_item', 'document_chat_sessions', type_='foreignkey')
    
    # Drop column
    op.drop_column('document_chat_sessions', 'knowledge_item_id')
