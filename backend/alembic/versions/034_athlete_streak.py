"""Add athlete streak preview flag and best_streak_weeks cache.

Revision ID: 034
Revises: 033
Create Date: 2026-08-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "034"
down_revision: Union[str, None] = "033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "athlete_profiles",
        sa.Column(
            "medals_preview_unlock_all",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "athlete_profiles",
        sa.Column(
            "best_streak_weeks",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("athlete_profiles", "best_streak_weeks")
    op.drop_column("athlete_profiles", "medals_preview_unlock_all")
