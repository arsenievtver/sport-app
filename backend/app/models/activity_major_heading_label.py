from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ActivityMajorHeadingLabel(Base):
    __tablename__ = "activity_major_heading_labels"

    heading: Mapped[str] = mapped_column(String(64), primary_key=True)
    label_ru: Mapped[str] = mapped_column(String(128), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
