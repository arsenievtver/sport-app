"""user.role -> user.roles array

Revision ID: 003
Revises: 002
Create Date: 2026-06-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role_enum = postgresql.ENUM("athlete", "coach", "admin", name="userrole", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "roles" in columns:
        return

    user_role_enum.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "roles",
            postgresql.ARRAY(user_role_enum),
            nullable=True,
        ),
    )

    if "role" in columns:
        op.execute("UPDATE users SET roles = ARRAY[role]")
        op.drop_index(op.f("ix_users_role"), table_name="users")
        op.drop_column("users", "role")

    op.alter_column("users", "roles", nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "role" in columns:
        return

    op.add_column(
        "users",
        sa.Column("role", user_role_enum, nullable=True),
    )
    op.execute("UPDATE users SET role = roles[1]")
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.alter_column("users", "role", nullable=False)
    op.drop_column("users", "roles")
