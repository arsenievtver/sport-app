from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class FoodNameTranslation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Cached food dish names translated for the athlete UI (e.g. LogMeal EN → RU)."""

    __tablename__ = "food_name_translations"
    __table_args__ = (
        UniqueConstraint("source", "external_id", "target_lang", name="uq_food_name_translation"),
    )

    source: Mapped[str] = mapped_column(String(32), nullable=False)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False)
    source_name: Mapped[str] = mapped_column(String(500), nullable=False)
    source_lang: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    target_lang: Mapped[str] = mapped_column(String(8), nullable=False, default="ru")
    translated_name: Mapped[str] = mapped_column(String(500), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False, default="yandex")
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
