"""coach athlete session ledger

Revision ID: 009
Revises: 008
Create Date: 2026-06-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "coach_athlete_session_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("link_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("sessions_count", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
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
        sa.ForeignKeyConstraint(["link_id"], ["coach_athlete_links.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_coach_athlete_session_entries_link_id"),
        "coach_athlete_session_entries",
        ["link_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_coach_athlete_session_entries_kind"),
        "coach_athlete_session_entries",
        ["kind"],
        unique=False,
    )
    op.create_index(
        op.f("ix_coach_athlete_session_entries_entry_date"),
        "coach_athlete_session_entries",
        ["entry_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_coach_athlete_session_entries_entry_date"),
        table_name="coach_athlete_session_entries",
    )
    op.drop_index(
        op.f("ix_coach_athlete_session_entries_kind"),
        table_name="coach_athlete_session_entries",
    )
    op.drop_index(
        op.f("ix_coach_athlete_session_entries_link_id"),
        table_name="coach_athlete_session_entries",
    )
    op.drop_table("coach_athlete_session_entries")
