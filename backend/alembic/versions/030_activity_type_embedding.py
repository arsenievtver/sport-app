"""activity_types.embedding for semantic search (pgvector)

Revision ID: 030
Revises: 029
Create Date: 2026-07-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Yandex text-search-doc / text-search-query embeddings are 256-dim.
EMBEDDING_DIM = 256


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column(
        "activity_types",
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_activity_types_embedding_cosine
        ON activity_types
        USING hnsw (embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_activity_types_embedding_cosine")
    op.drop_column("activity_types", "embedding")
