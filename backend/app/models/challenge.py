import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ChallengeStatus, ChallengeType


class Challenge(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Челлендж с нарастающей сложностью (P-05)."""

    __tablename__ = "challenges"

    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    challenge_type: Mapped[ChallengeType] = mapped_column(nullable=False)
    status: Mapped[ChallengeStatus] = mapped_column(
        default=ChallengeStatus.draft,
        nullable=False,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    difficulty_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # difficulty_config: {"levels": [{"week": 1, "target": 3}, {"week": 2, "target": 4}]}

    participants: Mapped[list["ChallengeParticipant"]] = relationship(
        back_populates="challenge",
        cascade="all, delete-orphan",
    )


class ChallengeParticipant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "challenge_participants"
    __table_args__ = (
        UniqueConstraint("challenge_id", "athlete_id", name="uq_challenge_athlete"),
    )

    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("challenges.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    progress: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    current_level: Mapped[int] = mapped_column(default=1, nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    completed_at: Mapped[date | None] = mapped_column(Date)

    challenge: Mapped["Challenge"] = relationship(back_populates="participants")
