"""athlete plan fields

Revision ID: 019
Revises: 018
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "athlete_profiles",
        sa.Column("plan_workouts_per_week", sa.Integer(), nullable=False, server_default="2"),
    )
    op.add_column(
        "athlete_profiles",
        sa.Column("daily_baseline_calories_kcal", sa.Float(), nullable=True),
    )
    op.add_column(
        "athlete_profiles",
        sa.Column("daily_baseline_activity_min", sa.Integer(), nullable=False, server_default="30"),
    )


def downgrade() -> None:
    op.drop_column("athlete_profiles", "daily_baseline_activity_min")
    op.drop_column("athlete_profiles", "daily_baseline_calories_kcal")
    op.drop_column("athlete_profiles", "plan_workouts_per_week")
