"""athlete AI chat threads and messages

Revision ID: 031
Revises: 030
Create Date: 2026-07-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "031"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "athlete_ai_chat_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
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
        op.f("ix_athlete_ai_chat_threads_athlete_id"),
        "athlete_ai_chat_threads",
        ["athlete_id"],
        unique=False,
    )

    op.create_table(
        "athlete_ai_chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_name", sa.String(length=100), nullable=True),
        sa.Column("tool_call_id", sa.String(length=100), nullable=True),
        sa.Column("tool_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
        sa.ForeignKeyConstraint(["thread_id"], ["athlete_ai_chat_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_athlete_ai_chat_messages_thread_id"),
        "athlete_ai_chat_messages",
        ["thread_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_athlete_ai_chat_messages_thread_id"),
        table_name="athlete_ai_chat_messages",
    )
    op.drop_table("athlete_ai_chat_messages")
    op.drop_index(
        op.f("ix_athlete_ai_chat_threads_athlete_id"),
        table_name="athlete_ai_chat_threads",
    )
    op.drop_table("athlete_ai_chat_threads")
