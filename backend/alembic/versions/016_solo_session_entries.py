"""solo session entries without coach link

Revision ID: 016
Revises: 015
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "coach_athlete_session_entries",
        "link_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.add_column(
        "coach_athlete_session_entries",
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_coach_athlete_session_entries_athlete_id",
        "coach_athlete_session_entries",
        "athlete_profiles",
        ["athlete_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_coach_athlete_session_entries_athlete_id"),
        "coach_athlete_session_entries",
        ["athlete_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_coach_athlete_session_entries_athlete_id"),
        table_name="coach_athlete_session_entries",
    )
    op.drop_constraint(
        "fk_coach_athlete_session_entries_athlete_id",
        "coach_athlete_session_entries",
        type_="foreignkey",
    )
    op.drop_column("coach_athlete_session_entries", "athlete_id")
    op.alter_column(
        "coach_athlete_session_entries",
        "link_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
