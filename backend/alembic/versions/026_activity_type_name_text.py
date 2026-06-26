"""widen activity type names for long compendium descriptions and translations

Revision ID: 026
Revises: 025
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "activity_types",
        "name_en",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "activity_types",
        "name_ru",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "activity_types",
        "name_ru",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=False,
    )
    op.alter_column(
        "activity_types",
        "name_en",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=False,
    )
