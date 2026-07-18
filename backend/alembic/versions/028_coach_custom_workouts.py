"""coach custom workouts: owner_coach_id + intervals

Revision ID: 028
Revises: 027
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "028"
down_revision: Union[str, None] = "027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "activity_types",
        "compendium_code",
        existing_type=sa.String(length=16),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
    op.add_column(
        "activity_types",
        sa.Column("owner_coach_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f("ix_activity_types_owner_coach_id"),
        "activity_types",
        ["owner_coach_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_activity_types_owner_coach_id",
        "activity_types",
        "coach_profiles",
        ["owner_coach_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_table(
        "coach_workout_intervals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("activity_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_activity_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(
            ["activity_type_id"],
            ["activity_types.id"],
            name="fk_coach_workout_intervals_activity_type_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_activity_type_id"],
            ["activity_types.id"],
            name="fk_coach_workout_intervals_source_activity_type_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_coach_workout_intervals_activity_type_id"),
        "coach_workout_intervals",
        ["activity_type_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_coach_workout_intervals_source_activity_type_id"),
        "coach_workout_intervals",
        ["source_activity_type_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_coach_workout_intervals_source_activity_type_id"),
        table_name="coach_workout_intervals",
    )
    op.drop_index(
        op.f("ix_coach_workout_intervals_activity_type_id"),
        table_name="coach_workout_intervals",
    )
    op.drop_table("coach_workout_intervals")
    op.drop_constraint("fk_activity_types_owner_coach_id", "activity_types", type_="foreignkey")
    op.drop_index(op.f("ix_activity_types_owner_coach_id"), table_name="activity_types")
    op.drop_column("activity_types", "owner_coach_id")
    op.alter_column(
        "activity_types",
        "compendium_code",
        existing_type=sa.String(length=64),
        type_=sa.String(length=16),
        existing_nullable=False,
    )
