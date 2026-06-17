"""managed athletes without app account

Revision ID: 010
Revises: 009
Create Date: 2026-06-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("athlete_profiles", "user_id", existing_type=postgresql.UUID(), nullable=True)
    op.add_column(
        "athlete_profiles",
        sa.Column("managed_by_coach_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "athlete_profiles",
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_athlete_profiles_managed_by_coach",
        "athlete_profiles",
        "coach_profiles",
        ["managed_by_coach_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_athlete_profiles_managed_by_coach_id",
        "athlete_profiles",
        ["managed_by_coach_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_athlete_profiles_managed_by_coach_id", table_name="athlete_profiles")
    op.drop_constraint("fk_athlete_profiles_managed_by_coach", "athlete_profiles", type_="foreignkey")
    op.drop_column("athlete_profiles", "claimed_at")
    op.drop_column("athlete_profiles", "managed_by_coach_id")
    op.alter_column("athlete_profiles", "user_id", existing_type=postgresql.UUID(), nullable=False)
