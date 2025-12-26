"""Add FeedbackLearning table for AI improvement tracking

Revision ID: add_feedback_learning
Revises: 
Create Date: 2024-12-23
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'add_feedback_learning'
down_revision = None  # Set to latest migration
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'feedback_learnings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('pattern', sa.Text(), nullable=False),
        sa.Column('applies_to', sa.String(50), default='all'),
        sa.Column('confidence', sa.Float(), default=0.5),
        sa.Column('learning_type', sa.String(50), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=True),
        sa.Column('original_answer', sa.Text(), nullable=True),
        sa.Column('edited_answer', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('usage_count', sa.Integer(), default=0),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for faster lookups
    op.create_index('ix_feedback_learnings_org_id', 'feedback_learnings', ['org_id'])
    op.create_index('ix_feedback_learnings_category', 'feedback_learnings', ['category'])


def downgrade():
    op.drop_index('ix_feedback_learnings_category')
    op.drop_index('ix_feedback_learnings_org_id')
    op.drop_table('feedback_learnings')
