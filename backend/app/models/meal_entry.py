import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AthleteMealEntry(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Logged meal / snack for calorie intake tracking."""

    __tablename__ = "athlete_meal_entries"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entry_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    calories_kcal: Mapped[float] = mapped_column(Float, nullable=False)
    title: Mapped[str | None] = mapped_column(String(500))
    weight_g: Mapped[float | None] = mapped_column(Float)
    protein_g: Mapped[float | None] = mapped_column(Float)
    carbs_g: Mapped[float | None] = mapped_column(Float)
    fat_g: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    logmeal_image_id: Mapped[int | None] = mapped_column(Integer)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    athlete: Mapped["AthleteProfile"] = relationship(back_populates="meal_entries")
