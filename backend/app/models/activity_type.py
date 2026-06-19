from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ActivityType(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Reference activity from the 2024 Adult Compendium of Physical Activities."""

    __tablename__ = "activity_types"

    compendium_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    name_ru: Mapped[str] = mapped_column(String(120), nullable=False)
    name_en: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    met_value: Mapped[float] = mapped_column(Float, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
