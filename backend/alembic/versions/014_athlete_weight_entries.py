"""athlete weight entries

Revision ID: 014
Revises: 013
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "athlete_weight_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
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
        sa.UniqueConstraint("athlete_id", "entry_date", name="uq_athlete_weight_entry_date"),
    )
    op.create_index(
        op.f("ix_athlete_weight_entries_athlete_id"),
        "athlete_weight_entries",
        ["athlete_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_athlete_weight_entries_entry_date"),
        "athlete_weight_entries",
        ["entry_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_athlete_weight_entries_entry_date"), table_name="athlete_weight_entries")
    op.drop_index(op.f("ix_athlete_weight_entries_athlete_id"), table_name="athlete_weight_entries")
    op.drop_table("athlete_weight_entries")
