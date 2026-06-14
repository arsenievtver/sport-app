"""personal goal title + target (replaces free_goal)

Revision ID: 006
Revises: 005
Create Date: 2026-06-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("athlete_profiles", sa.Column("personal_goal_title", sa.String(length=200), nullable=True))
    op.add_column("athlete_profiles", sa.Column("personal_goal_target", sa.Float(), nullable=True))
    op.drop_column("athlete_profiles", "free_goal")


def downgrade() -> None:
    op.add_column("athlete_profiles", sa.Column("free_goal", sa.Text(), nullable=True))
    op.drop_column("athlete_profiles", "personal_goal_target")
    op.drop_column("athlete_profiles", "personal_goal_title")
