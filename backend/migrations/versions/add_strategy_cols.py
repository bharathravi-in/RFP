"""add_case_studies_and_sprint_timeline_columns

Revision ID: add_strategy_cols
Revises: 
Create Date: 2026-01-09

Adds missing columns to project_strategies table:
- case_studies (JSONB)
- case_studies_generated_at (TIMESTAMP)
- sprint_timeline (JSONB)
- sprint_timeline_generated_at (TIMESTAMP)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_strategy_cols'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add case_studies columns
    op.add_column('project_strategies', 
        sa.Column('case_studies', sa.JSON(), nullable=True)
    )
    op.add_column('project_strategies', 
        sa.Column('case_studies_generated_at', sa.DateTime(), nullable=True)
    )
    
    # Add sprint_timeline columns
    op.add_column('project_strategies', 
        sa.Column('sprint_timeline', sa.JSON(), nullable=True)
    )
    op.add_column('project_strategies', 
        sa.Column('sprint_timeline_generated_at', sa.DateTime(), nullable=True)
    )


def downgrade():
    op.drop_column('project_strategies', 'sprint_timeline_generated_at')
    op.drop_column('project_strategies', 'sprint_timeline')
    op.drop_column('project_strategies', 'case_studies_generated_at')
    op.drop_column('project_strategies', 'case_studies')
