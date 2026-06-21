"""athlete meal entries

Revision ID: 021
Revises: 020
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "athlete_meal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("calories_kcal", sa.Float(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("weight_g", sa.Float(), nullable=True),
        sa.Column("protein_g", sa.Float(), nullable=True),
        sa.Column("carbs_g", sa.Float(), nullable=True),
        sa.Column("fat_g", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=16), nullable=False, server_default="manual"),
        sa.Column("logmeal_image_id", sa.Integer(), nullable=True),
        sa.Column("ai_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["athlete_id"], ["athlete_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_athlete_meal_entries_athlete_id"),
        "athlete_meal_entries",
        ["athlete_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_athlete_meal_entries_entry_at"),
        "athlete_meal_entries",
        ["entry_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_athlete_meal_entries_entry_at"), table_name="athlete_meal_entries")
    op.drop_index(op.f("ix_athlete_meal_entries_athlete_id"), table_name="athlete_meal_entries")
    op.drop_table("athlete_meal_entries")
