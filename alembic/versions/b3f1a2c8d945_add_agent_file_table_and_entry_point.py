"""add_agent_file_table_and_entry_point

Revision ID: b3f1a2c8d945
Revises: 408219e2f718
Create Date: 2026-04-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f1a2c8d945'
down_revision: Union[str, Sequence[str], None] = '408219e2f718'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('agent_file',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('agent_id', sa.UUID(), nullable=False),
        sa.Column('path', sa.String(length=500), nullable=False),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('language', sa.String(length=50), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='generating'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['agent.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agent_id', 'path', name='uq_agent_file_agent_path')
    )
    op.add_column('agent', sa.Column('entry_point', sa.String(length=500), nullable=True, server_default='main.py'))


def downgrade() -> None:
    op.drop_column('agent', 'entry_point')
    op.drop_table('agent_file')
