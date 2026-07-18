import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.activity_type import ActivityType


class CoachWorkoutInterval(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Interval inside a coach-owned composite workout (ActivityType with owner_coach_id)."""

    __tablename__ = "coach_workout_intervals"

    activity_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_types.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_activity_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_types.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    label: Mapped[str | None] = mapped_column(String(120))

    workout: Mapped["ActivityType"] = relationship(
        "ActivityType",
        foreign_keys=[activity_type_id],
        back_populates="workout_intervals",
    )
    source_activity: Mapped["ActivityType"] = relationship(
        "ActivityType",
        foreign_keys=[source_activity_type_id],
    )
