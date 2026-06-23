"""logmeal dish nutrition lazy cache

Revision ID: 024
Revises: 023
Create Date: 2026-06-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("logmeal_dish_catalog", sa.Column("cached_weight_g", sa.Float(), nullable=True))
    op.add_column("logmeal_dish_catalog", sa.Column("cached_calories_kcal", sa.Float(), nullable=True))
    op.add_column("logmeal_dish_catalog", sa.Column("cached_protein_g", sa.Float(), nullable=True))
    op.add_column("logmeal_dish_catalog", sa.Column("cached_carbs_g", sa.Float(), nullable=True))
    op.add_column("logmeal_dish_catalog", sa.Column("cached_fat_g", sa.Float(), nullable=True))
    op.add_column(
        "logmeal_dish_catalog",
        sa.Column("nutrition_cached_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("logmeal_dish_catalog", "nutrition_cached_at")
    op.drop_column("logmeal_dish_catalog", "cached_fat_g")
    op.drop_column("logmeal_dish_catalog", "cached_carbs_g")
    op.drop_column("logmeal_dish_catalog", "cached_protein_g")
    op.drop_column("logmeal_dish_catalog", "cached_calories_kcal")
    op.drop_column("logmeal_dish_catalog", "cached_weight_g")
