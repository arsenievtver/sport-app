"""coach profile avatar

Revision ID: 008
Revises: 007
Create Date: 2026-06-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("coach_profiles", sa.Column("avatar_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("coach_profiles", "avatar_url")
