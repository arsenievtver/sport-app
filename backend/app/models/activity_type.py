import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.coach_workout_interval import CoachWorkoutInterval
    from app.models.user import CoachProfile


class ActivityType(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Compendium activity, or a coach-owned composite workout (owner_coach_id set)."""

    __tablename__ = "activity_types"

    compendium_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name_ru: Mapped[str] = mapped_column(Text, nullable=False)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    major_heading: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    met_value: Mapped[float] = mapped_column(Float, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    owner_coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    owner_coach: Mapped["CoachProfile | None"] = relationship()
    workout_intervals: Mapped[list["CoachWorkoutInterval"]] = relationship(
        "CoachWorkoutInterval",
        foreign_keys="CoachWorkoutInterval.activity_type_id",
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="CoachWorkoutInterval.sort_order",
    )
