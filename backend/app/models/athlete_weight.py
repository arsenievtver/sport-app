import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AthleteWeightEntry(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One weight measurement per athlete per calendar day (athlete timezone)."""

    __tablename__ = "athlete_weight_entries"
    __table_args__ = (
        UniqueConstraint("athlete_id", "entry_date", name="uq_athlete_weight_entry_date"),
    )

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)

    athlete: Mapped["AthleteProfile"] = relationship(back_populates="weight_entries")
