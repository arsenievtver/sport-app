"""schedule slot completions

Revision ID: 018
Revises: 017
Create Date: 2026-06-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_slot_completions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("coach_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("session_entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["athlete_id"], ["athlete_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["coach_id"], ["coach_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_entry_id"], ["coach_athlete_session_entries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "coach_id",
            "athlete_id",
            "occurrence_date",
            "start_time",
            name="uq_schedule_slot_completion",
        ),
        sa.UniqueConstraint("session_entry_id"),
    )
    op.create_index(
        op.f("ix_schedule_slot_completions_athlete_id"),
        "schedule_slot_completions",
        ["athlete_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_schedule_slot_completions_coach_id"),
        "schedule_slot_completions",
        ["coach_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_schedule_slot_completions_occurrence_date"),
        "schedule_slot_completions",
        ["occurrence_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_schedule_slot_completions_occurrence_date"), table_name="schedule_slot_completions")
    op.drop_index(op.f("ix_schedule_slot_completions_coach_id"), table_name="schedule_slot_completions")
    op.drop_index(op.f("ix_schedule_slot_completions_athlete_id"), table_name="schedule_slot_completions")
    op.drop_table("schedule_slot_completions")
