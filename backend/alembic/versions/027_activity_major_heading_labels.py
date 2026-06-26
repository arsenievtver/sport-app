"""activity major heading label overrides

Revision ID: 027
Revises: 026
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_major_heading_labels",
        sa.Column("heading", sa.String(length=64), nullable=False),
        sa.Column("label_ru", sa.String(length=128), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("heading"),
    )


def downgrade() -> None:
    op.drop_table("activity_major_heading_labels")
