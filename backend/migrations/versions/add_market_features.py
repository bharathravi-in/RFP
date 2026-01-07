"""Add market feature columns

Revision ID: add_market_features
Revises: f13803b515b5
Create Date: 2024-12-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_market_features'
down_revision = 'f13803b515b5'
branch_labels = None
depends_on = None


def upgrade():
    # Add expertise_tags to users table
    op.add_column('users', sa.Column('expertise_tags', sa.JSON(), nullable=True))
    
    # Add verification_score to answers table
    op.add_column('answers', sa.Column('verification_score', sa.Float(), nullable=True, server_default='0.0'))
    
    # Add assigned_to and due_date to questions table
    op.add_column('questions', sa.Column('assigned_to', sa.Integer(), nullable=True))
    op.add_column('questions', sa.Column('due_date', sa.DateTime(), nullable=True))
    
    # Add foreign key for assigned_to -> users.id
    op.create_foreign_key(
        'fk_questions_assigned_to_users',
        'questions', 'users',
        ['assigned_to'], ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    # Remove foreign key first
    op.drop_constraint('fk_questions_assigned_to_users', 'questions', type_='foreignkey')
    
    # Remove columns
    op.drop_column('questions', 'due_date')
    op.drop_column('questions', 'assigned_to')
    op.drop_column('answers', 'verification_score')
    op.drop_column('users', 'expertise_tags')
