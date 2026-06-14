import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class HealthConnection(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """OAuth-подключение атлета к источнику данных о здоровье (WHOOP и др.)."""

    __tablename__ = "health_connections"
    __table_args__ = (UniqueConstraint("athlete_id", "provider", name="uq_health_connection_provider"),)

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    external_user_id: Mapped[str | None] = mapped_column(String(64))
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[str | None] = mapped_column(String(512))
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_error: Mapped[str | None] = mapped_column(Text)
    last_sync_payload: Mapped[dict | None] = mapped_column(JSONB)

    athlete: Mapped["AthleteProfile"] = relationship(  # noqa: F821
        foreign_keys=[athlete_id],
    )
