"""schedule slot activity type

Revision ID: 017
Revises: 016
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "schedule_template_slots",
        sa.Column("activity_type_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_schedule_template_slots_activity_type_id",
        "schedule_template_slots",
        "activity_types",
        ["activity_type_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_schedule_template_slots_activity_type_id"),
        "schedule_template_slots",
        ["activity_type_id"],
        unique=False,
    )

    op.add_column(
        "schedule_week_exceptions",
        sa.Column("activity_type_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_schedule_week_exceptions_activity_type_id",
        "schedule_week_exceptions",
        "activity_types",
        ["activity_type_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_schedule_week_exceptions_activity_type_id"),
        "schedule_week_exceptions",
        ["activity_type_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_schedule_week_exceptions_activity_type_id"),
        table_name="schedule_week_exceptions",
    )
    op.drop_constraint(
        "fk_schedule_week_exceptions_activity_type_id",
        "schedule_week_exceptions",
        type_="foreignkey",
    )
    op.drop_column("schedule_week_exceptions", "activity_type_id")

    op.drop_index(
        op.f("ix_schedule_template_slots_activity_type_id"),
        table_name="schedule_template_slots",
    )
    op.drop_constraint(
        "fk_schedule_template_slots_activity_type_id",
        "schedule_template_slots",
        type_="foreignkey",
    )
    op.drop_column("schedule_template_slots", "activity_type_id")
