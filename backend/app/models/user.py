import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CoachAthleteLinkStatus, Gender, UserRole

user_role_enum = SQLEnum(UserRole, name="userrole", create_constraint=False)
gender_enum = SQLEnum(Gender, name="gender", create_constraint=False, native_enum=False)


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    phone: Mapped[str] = mapped_column(String(11), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    roles: Mapped[list[UserRole]] = mapped_column(
        ARRAY(user_role_enum),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def has_role(self, role: UserRole) -> bool:
        return role in self.roles

    coach_profile: Mapped["CoachProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    athlete_profile: Mapped["AthleteProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class CoachProfile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "coach_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    bio: Mapped[str | None] = mapped_column(Text)
    invite_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="coach_profile")
    athlete_links: Mapped[list["CoachAthleteLink"]] = relationship(
        back_populates="coach",
        foreign_keys="CoachAthleteLink.coach_id",
    )


class AthleteProfile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "athlete_profiles"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
    )
    managed_by_coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    gender: Mapped[Gender | None] = mapped_column(gender_enum, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date)
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    # Training focus importance scores (20–100 each, independent).
    focus_strength: Mapped[int | None] = mapped_column(Integer)
    focus_flexibility: Mapped[int | None] = mapped_column(Integer)
    focus_endurance: Mapped[int | None] = mapped_column(Integer)
    focus_coordination: Mapped[int | None] = mapped_column(Integer)
    weight_target_min_kg: Mapped[float | None] = mapped_column(Float)
    weight_target_max_kg: Mapped[float | None] = mapped_column(Float)
    personal_goal_title: Mapped[str | None] = mapped_column(String(200))
    personal_goal_target: Mapped[float | None] = mapped_column(Float)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recent_activity_type_ids: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    user: Mapped["User"] = relationship(back_populates="athlete_profile")
    coach_links: Mapped[list["CoachAthleteLink"]] = relationship(
        back_populates="athlete",
        foreign_keys="CoachAthleteLink.athlete_id",
    )
    weight_entries: Mapped[list["AthleteWeightEntry"]] = relationship(
        back_populates="athlete",
        cascade="all, delete-orphan",
    )


class CoachAthleteLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "coach_athlete_links"
    __table_args__ = (UniqueConstraint("coach_id", "athlete_id", name="uq_coach_athlete"),)

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[CoachAthleteLinkStatus] = mapped_column(
        default=CoachAthleteLinkStatus.pending,
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    # Remaining paid sessions for this coach–athlete pair (can go negative).
    sessions_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    coach: Mapped["CoachProfile"] = relationship(
        back_populates="athlete_links",
        foreign_keys=[coach_id],
    )
    athlete: Mapped["AthleteProfile"] = relationship(
        back_populates="coach_links",
        foreign_keys=[athlete_id],
    )
    session_entries: Mapped[list["CoachAthleteSessionEntry"]] = relationship(
        back_populates="link",
        cascade="all, delete-orphan",
    )
