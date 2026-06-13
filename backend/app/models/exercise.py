import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Exercise(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Библиотека упражнений (T-03). coach_id=NULL — глобальное упражнение платформы."""

    __tablename__ = "exercises"

    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    instructions: Mapped[str | None] = mapped_column(Text)
    muscle_groups: Mapped[list[str]] = mapped_column(ARRAY(String(64)), default=list, nullable=False)
    equipment: Mapped[list[str]] = mapped_column(ARRAY(String(64)), default=list, nullable=False)
    difficulty: Mapped[int | None] = mapped_column()  # 1–5
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    video_url: Mapped[str | None] = mapped_column(String(512))
    thumbnail_url: Mapped[str | None] = mapped_column(String(512))

    workout_items: Mapped[list["WorkoutExercise"]] = relationship(back_populates="exercise")
