from datetime import datetime

from sqlalchemy import DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ActivityCompendiumImport(Base):
    """Single-row metadata for the last compendium PDF import."""

    __tablename__ = "activity_compendium_import"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    activity_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
