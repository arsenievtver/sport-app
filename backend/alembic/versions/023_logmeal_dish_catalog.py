"""logmeal dish catalog cache

Revision ID: 023
Revises: 022
Create Date: 2026-06-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "logmeal_dish_catalog",
        sa.Column("logmeal_id", sa.Integer(), nullable=False),
        sa.Column("name_en", sa.String(length=500), nullable=False),
        sa.Column("name_ru", sa.String(length=500), nullable=True),
        sa.Column("portion_size_g", sa.Float(), nullable=True),
        sa.Column("dish_type", sa.String(length=32), nullable=False),
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
        sa.PrimaryKeyConstraint("logmeal_id"),
    )
    op.create_index(
        op.f("ix_logmeal_dish_catalog_name_en"),
        "logmeal_dish_catalog",
        [sa.text("lower(name_en)")],
        unique=False,
    )
    op.create_index(
        op.f("ix_logmeal_dish_catalog_name_ru"),
        "logmeal_dish_catalog",
        [sa.text("lower(name_ru)")],
        unique=False,
        postgresql_where=sa.text("name_ru IS NOT NULL"),
    )

    op.create_table(
        "logmeal_catalog_sync",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("dish_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("logmeal_catalog_sync")
    op.drop_index(op.f("ix_logmeal_dish_catalog_name_ru"), table_name="logmeal_dish_catalog")
    op.drop_index(op.f("ix_logmeal_dish_catalog_name_en"), table_name="logmeal_dish_catalog")
    op.drop_table("logmeal_dish_catalog")
