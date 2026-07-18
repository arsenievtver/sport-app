"""Activate all Compendium activity types

Revision ID: 029
Revises: 028
Create Date: 2026-07-18
"""

from typing import Sequence, Union

from alembic import op

revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE activity_types
        SET is_active = true
        WHERE owner_coach_id IS NULL
        """
    )


def downgrade() -> None:
    # Intentionally no-op: cannot restore previous is_active flags.
    pass
