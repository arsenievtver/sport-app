"""coach schedule settings, template slots, week exceptions

Revision ID: 011
Revises: 010
Create Date: 2026-06-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "coach_schedule_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("coach_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("work_days", postgresql.JSONB(), nullable=False),
        sa.Column("slot_start", sa.Time(), nullable=False),
        sa.Column("slot_end", sa.Time(), nullable=False),
        sa.Column("lunch_start", sa.Time(), nullable=True),
        sa.Column("lunch_end", sa.Time(), nullable=True),
        sa.Column("slot_duration_min", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Europe/Moscow"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["coach_id"], ["coach_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("coach_id"),
    )
    op.create_index("ix_coach_schedule_settings_coach_id", "coach_schedule_settings", ["coach_id"])

    op.create_table(
        "schedule_template_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("coach_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["athlete_id"], ["athlete_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["coach_id"], ["coach_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("coach_id", "day_of_week", "start_time", name="uq_schedule_template_slot"),
    )
    op.create_index("ix_schedule_template_slots_coach_id", "schedule_template_slots", ["coach_id"])
    op.create_index("ix_schedule_template_slots_athlete_id", "schedule_template_slots", ["athlete_id"])

    op.create_table(
        "schedule_week_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("coach_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["athlete_id"], ["athlete_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["coach_id"], ["coach_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "coach_id",
            "occurrence_date",
            "start_time",
            name="uq_schedule_week_exception",
        ),
    )
    op.create_index("ix_schedule_week_exceptions_coach_id", "schedule_week_exceptions", ["coach_id"])
    op.create_index("ix_schedule_week_exceptions_occurrence_date", "schedule_week_exceptions", ["occurrence_date"])
    op.create_index("ix_schedule_week_exceptions_athlete_id", "schedule_week_exceptions", ["athlete_id"])


def downgrade() -> None:
    op.drop_index("ix_schedule_week_exceptions_athlete_id", table_name="schedule_week_exceptions")
    op.drop_index("ix_schedule_week_exceptions_occurrence_date", table_name="schedule_week_exceptions")
    op.drop_index("ix_schedule_week_exceptions_coach_id", table_name="schedule_week_exceptions")
    op.drop_table("schedule_week_exceptions")
    op.drop_index("ix_schedule_template_slots_athlete_id", table_name="schedule_template_slots")
    op.drop_index("ix_schedule_template_slots_coach_id", table_name="schedule_template_slots")
    op.drop_table("schedule_template_slots")
    op.drop_index("ix_coach_schedule_settings_coach_id", table_name="coach_schedule_settings")
    op.drop_table("coach_schedule_settings")
