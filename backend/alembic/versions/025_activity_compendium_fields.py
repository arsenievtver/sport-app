"""activity compendium fields and import metadata

Revision ID: 025
Revises: 024
Create Date: 2026-06-25

Adds major_heading grouping from the 2024 Adult Compendium PDF and widens name columns.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "activity_types",
        "name_en",
        existing_type=sa.String(length=120),
        type_=sa.String(length=512),
        existing_nullable=False,
    )
    op.alter_column(
        "activity_types",
        "name_ru",
        existing_type=sa.String(length=120),
        type_=sa.String(length=512),
        existing_nullable=False,
    )
    op.add_column(
        "activity_types",
        sa.Column("major_heading", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_activity_types_major_heading"),
        "activity_types",
        ["major_heading"],
        unique=False,
    )

    op.create_table(
        "activity_compendium_import",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activity_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("activity_compendium_import")
    op.drop_index(op.f("ix_activity_types_major_heading"), table_name="activity_types")
    op.drop_column("activity_types", "major_heading")
    op.alter_column(
        "activity_types",
        "name_ru",
        existing_type=sa.String(length=512),
        type_=sa.String(length=120),
        existing_nullable=False,
    )
    op.alter_column(
        "activity_types",
        "name_en",
        existing_type=sa.String(length=512),
        type_=sa.String(length=120),
        existing_nullable=False,
    )
