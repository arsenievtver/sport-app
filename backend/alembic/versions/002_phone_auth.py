"""phone auth: email -> phone login

Revision ID: 002
Revises: 001
Create Date: 2026-06-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "email" in columns and "phone" not in columns:
        op.alter_column("users", "email", new_column_name="phone", existing_type=sa.String(length=320))
        op.alter_column("users", "phone", type_=sa.String(length=11), existing_nullable=False)
    elif "phone" not in columns:
        op.add_column("users", sa.Column("phone", sa.String(length=11), nullable=False))
        op.create_index(op.f("ix_users_phone"), "users", ["phone"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "phone" in columns and "email" not in columns:
        op.alter_column("users", "phone", type_=sa.String(length=320), existing_nullable=False)
        op.alter_column("users", "phone", new_column_name="email", existing_type=sa.String(length=320))
