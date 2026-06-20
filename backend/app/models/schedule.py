import uuid
from datetime import date, time
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import CoachProfile


class CoachScheduleSettings(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Рабочие часы и параметры сетки расписания тренера."""

    __tablename__ = "coach_schedule_settings"

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    work_days: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    slot_start: Mapped[time] = mapped_column(Time, nullable=False)
    slot_end: Mapped[time] = mapped_column(Time, nullable=False)
    lunch_start: Mapped[time | None] = mapped_column(Time)
    lunch_end: Mapped[time | None] = mapped_column(Time)
    slot_duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Europe/Moscow")

    coach: Mapped["CoachProfile"] = relationship()


class ScheduleTemplateSlot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Шаблон недели: атлет на слот (день + время)."""

    __tablename__ = "schedule_template_slots"
    __table_args__ = (
        UniqueConstraint(
            "coach_id",
            "day_of_week",
            "start_time",
            name="uq_schedule_template_slot",
        ),
    )

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon … 6=Sun
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    athlete_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    activity_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_types.id", ondelete="SET NULL"),
        index=True,
    )

    athlete: Mapped["AthleteProfile | None"] = relationship()
    activity_type: Mapped["ActivityType | None"] = relationship()


class ScheduleWeekException(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Исключение для конкретной даты: отмена, перенос, разовое назначение."""

    __tablename__ = "schedule_week_exceptions"
    __table_args__ = (
        UniqueConstraint(
            "coach_id",
            "occurrence_date",
            "start_time",
            name="uq_schedule_week_exception",
        ),
    )

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    occurrence_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    athlete_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    activity_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_types.id", ondelete="SET NULL"),
        index=True,
    )

    athlete: Mapped["AthleteProfile | None"] = relationship()
    activity_type: Mapped["ActivityType | None"] = relationship()


from app.models.activity_type import ActivityType  # noqa: E402, F401
from app.models.user import AthleteProfile  # noqa: E402, F401
