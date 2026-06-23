from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class LogMealDishCatalog(Base, TimestampMixin):
    """Local cache of LogMeal /dataset/dishes for server-side search."""

    __tablename__ = "logmeal_dish_catalog"

    logmeal_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name_en: Mapped[str] = mapped_column(String(500), nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String(500))
    portion_size_g: Mapped[float | None] = mapped_column(Float)
    dish_type: Mapped[str] = mapped_column(String(32), nullable=False)
    cached_weight_g: Mapped[float | None] = mapped_column(Float)
    cached_calories_kcal: Mapped[float | None] = mapped_column(Float)
    cached_protein_g: Mapped[float | None] = mapped_column(Float)
    cached_carbs_g: Mapped[float | None] = mapped_column(Float)
    cached_fat_g: Mapped[float | None] = mapped_column(Float)
    nutrition_cached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LogMealCatalogSync(Base):
    """Single-row metadata for the last catalog sync."""

    __tablename__ = "logmeal_catalog_sync"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    dish_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
