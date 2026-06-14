"""athlete onboarding fields

Revision ID: 005
Revises: 004
Create Date: 2026-06-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("athlete_profiles", sa.Column("gender", sa.String(length=32), nullable=True))
    op.add_column("athlete_profiles", sa.Column("focus_strength", sa.Integer(), nullable=True))
    op.add_column("athlete_profiles", sa.Column("focus_flexibility", sa.Integer(), nullable=True))
    op.add_column("athlete_profiles", sa.Column("focus_endurance", sa.Integer(), nullable=True))
    op.add_column("athlete_profiles", sa.Column("focus_coordination", sa.Integer(), nullable=True))
    op.add_column("athlete_profiles", sa.Column("weight_target_min_kg", sa.Float(), nullable=True))
    op.add_column("athlete_profiles", sa.Column("weight_target_max_kg", sa.Float(), nullable=True))
    op.add_column("athlete_profiles", sa.Column("free_goal", sa.Text(), nullable=True))
    op.add_column(
        "athlete_profiles",
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("athlete_profiles", "onboarding_completed_at")
    op.drop_column("athlete_profiles", "free_goal")
    op.drop_column("athlete_profiles", "weight_target_max_kg")
    op.drop_column("athlete_profiles", "weight_target_min_kg")
    op.drop_column("athlete_profiles", "focus_coordination")
    op.drop_column("athlete_profiles", "focus_endurance")
    op.drop_column("athlete_profiles", "focus_flexibility")
    op.drop_column("athlete_profiles", "focus_strength")
    op.drop_column("athlete_profiles", "gender")
