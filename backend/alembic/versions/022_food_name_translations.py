"""food name translations cache

Revision ID: 022
Revises: 021
Create Date: 2026-06-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "food_name_translations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.Integer(), nullable=False),
        sa.Column("source_name", sa.String(length=500), nullable=False),
        sa.Column("source_lang", sa.String(length=8), nullable=False, server_default="en"),
        sa.Column("target_lang", sa.String(length=8), nullable=False, server_default="ru"),
        sa.Column("translated_name", sa.String(length=500), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False, server_default="yandex"),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "external_id", "target_lang", name="uq_food_name_translation"),
    )
    op.create_index(
        op.f("ix_food_name_translations_source_external_id"),
        "food_name_translations",
        ["source", "external_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_food_name_translations_source_external_id"),
        table_name="food_name_translations",
    )
    op.drop_table("food_name_translations")
