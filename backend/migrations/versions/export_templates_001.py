"""Export templates table

Revision ID: export_templates_001
Revises: 
Create Date: 2024-12-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'export_templates_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Create export_templates table."""
    op.create_table(
        'export_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('template_type', sa.String(20), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for faster lookups
    op.create_index(
        'ix_export_templates_org_type',
        'export_templates',
        ['organization_id', 'template_type']
    )


def downgrade():
    """Drop export_templates table."""
    op.drop_index('ix_export_templates_org_type', table_name='export_templates')
    op.drop_table('export_templates')
