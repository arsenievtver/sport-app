import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ProgramStatus


class Program(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Тренировочная программа (T-02). Шаблон или назначенная спортсмену."""

    __tablename__ = "programs"

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    athlete_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ProgramStatus] = mapped_column(
        default=ProgramStatus.draft,
        nullable=False,
        index=True,
    )
    is_template: Mapped[bool] = mapped_column(default=False, nullable=False)
    duration_weeks: Mapped[int | None] = mapped_column(Integer)
    start_date: Mapped[date | None] = mapped_column(Date)

    weeks: Mapped[list["ProgramWeek"]] = relationship(
        back_populates="program",
        cascade="all, delete-orphan",
        order_by="ProgramWeek.week_number",
    )


class ProgramWeek(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "program_weeks"

    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)

    program: Mapped["Program"] = relationship(back_populates="weeks")
    workouts: Mapped[list["Workout"]] = relationship(
        back_populates="program_week",
        cascade="all, delete-orphan",
        order_by="Workout.day_of_week",
    )
