import uuid
from datetime import date

from sqlalchemy import Date, Enum as SQLEnum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CoachAthleteSessionEntryKind

session_entry_kind_enum = SQLEnum(
    CoachAthleteSessionEntryKind,
    name="coachathletesessionentrykind",
    create_constraint=False,
    native_enum=False,
)


class CoachAthleteSessionEntry(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Ledger of session credits/debits for a coach–athlete link."""

    __tablename__ = "coach_athlete_session_entries"

    link_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_athlete_links.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[CoachAthleteSessionEntryKind] = mapped_column(
        session_entry_kind_enum,
        nullable=False,
        index=True,
    )
    sessions_count: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    link: Mapped["CoachAthleteLink"] = relationship(back_populates="session_entries")
