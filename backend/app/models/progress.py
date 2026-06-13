import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProgressSnapshot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Агрегированный прогресс за период (P-02, P-04)."""

    __tablename__ = "progress_snapshots"
    __table_args__ = (
        UniqueConstraint("athlete_id", "period_start", "period_end", name="uq_progress_period"),
    )

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="SET NULL"),
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # metrics example: {"sessions_completed": 4, "total_volume_kg": 12500, "streak_days": 3}
    summary_text: Mapped[str | None] = mapped_column(Text)  # аффективный feedback


class AnalyticsEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Engagement-события (DoD backlog)."""

    __tablename__ = "analytics_events"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    event_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(64))
    app_source: Mapped[str | None] = mapped_column(String(32))  # athlete, coach, coach-web, admin
