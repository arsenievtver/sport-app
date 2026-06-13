import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import WorkoutLogStatus, WorkoutStatus


class Workout(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Запланированная тренировка внутри программы или standalone."""

    __tablename__ = "workouts"

    program_week_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("program_weeks.id", ondelete="CASCADE"),
        index=True,
    )
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
    day_of_week: Mapped[int | None] = mapped_column(Integer)  # 0=Mon … 6=Sun
    scheduled_date: Mapped[date | None] = mapped_column(Date, index=True)
    status: Mapped[WorkoutStatus] = mapped_column(
        default=WorkoutStatus.scheduled,
        nullable=False,
        index=True,
    )
    rescheduled_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workouts.id", ondelete="SET NULL"),
    )
    estimated_duration_min: Mapped[int | None] = mapped_column(Integer)

    program_week: Mapped["ProgramWeek | None"] = relationship(back_populates="workouts")
    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="WorkoutExercise.sort_order",
    )
    logs: Mapped[list["WorkoutLog"]] = relationship(back_populates="workout")


class WorkoutExercise(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Упражнение в тренировке с целевыми параметрами."""

    __tablename__ = "workout_exercises"

    workout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workouts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_sets: Mapped[int | None] = mapped_column(Integer)
    target_reps: Mapped[str | None] = mapped_column(String(32))  # "8-12", "AMRAP"
    target_weight_kg: Mapped[float | None] = mapped_column(Float)
    target_duration_sec: Mapped[int | None] = mapped_column(Integer)
    target_distance_m: Mapped[float | None] = mapped_column(Float)
    rest_sec: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    superset_group: Mapped[int | None] = mapped_column(Integer)

    workout: Mapped["Workout"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship(back_populates="workout_items")
    log_entries: Mapped[list["WorkoutLogExercise"]] = relationship(back_populates="workout_exercise")


class WorkoutLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Факт выполнения тренировки спортсменом (B-01)."""

    __tablename__ = "workout_logs"

    workout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workouts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[WorkoutLogStatus] = mapped_column(
        default=WorkoutLogStatus.in_progress,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    athlete_notes: Mapped[str | None] = mapped_column(Text)
    perceived_effort: Mapped[int | None] = mapped_column(Integer)  # RPE 1–10

    workout: Mapped["Workout"] = relationship(back_populates="logs")
    exercise_logs: Mapped[list["WorkoutLogExercise"]] = relationship(
        back_populates="workout_log",
        cascade="all, delete-orphan",
    )


class WorkoutLogExercise(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Факт выполнения упражнения: подходы, замены (A-01)."""

    __tablename__ = "workout_log_exercises"

    workout_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workout_logs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workout_exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workout_exercises.id", ondelete="SET NULL"),
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="RESTRICT"),
        nullable=False,
    )
    substituted: Mapped[bool] = mapped_column(default=False, nullable=False)
    substitution_reason: Mapped[str | None] = mapped_column(Text)
    sets_data: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # sets_data example: [{"set": 1, "reps": 10, "weight_kg": 60, "duration_sec": null}]

    workout_log: Mapped["WorkoutLog"] = relationship(back_populates="exercise_logs")
    workout_exercise: Mapped["WorkoutExercise | None"] = relationship(back_populates="log_entries")
