"""session entry calories

Revision ID: 015
Revises: 014
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("coach_athlete_session_entries", sa.Column("weight_kg_used", sa.Float(), nullable=True))
    op.add_column("coach_athlete_session_entries", sa.Column("calories_kcal", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("coach_athlete_session_entries", "calories_kcal")
    op.drop_column("coach_athlete_session_entries", "weight_kg_used")
