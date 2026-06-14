from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.security import validate_phone, validate_pin
from app.models.enums import CoachAthleteLinkStatus

PHONE_EXAMPLE = "79106492742"
PIN_EXAMPLE = "123456"


class LinkedAthleteSummary(BaseModel):
    link_id: UUID
    athlete_id: UUID
    display_name: str
    status: CoachAthleteLinkStatus


class LinkedCoachSummary(BaseModel):
    link_id: UUID
    coach_id: UUID
    display_name: str
    status: CoachAthleteLinkStatus


class AdminCoachResponse(BaseModel):
    id: UUID
    user_id: UUID
    phone: str
    display_name: str
    bio: str | None
    invite_code: str
    is_verified: bool
    is_active: bool
    athletes: list[LinkedAthleteSummary]
    created_at: datetime


class AdminAthleteResponse(BaseModel):
    id: UUID
    user_id: UUID
    phone: str
    display_name: str
    birth_date: date | None
    timezone: str
    is_active: bool
    coaches: list[LinkedCoachSummary]
    created_at: datetime


class AdminCoachCreate(BaseModel):
    phone: str = Field(examples=[PHONE_EXAMPLE])
    pin: str = Field(examples=[PIN_EXAMPLE])
    display_name: str = Field(min_length=1, max_length=120)
    bio: str | None = None
    is_verified: bool = False
    athlete_ids: list[UUID] = Field(default_factory=list)

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        return validate_phone(value)

    @field_validator("pin")
    @classmethod
    def check_pin(cls, value: str) -> str:
        return validate_pin(value)


class AdminCoachUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = None
    is_verified: bool | None = None
    is_active: bool | None = None
    pin: str | None = None
    athlete_ids: list[UUID] | None = None

    @field_validator("pin")
    @classmethod
    def check_pin(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_pin(value)


class AdminAthleteCreate(BaseModel):
    phone: str = Field(examples=[PHONE_EXAMPLE])
    pin: str = Field(examples=[PIN_EXAMPLE])
    display_name: str = Field(min_length=1, max_length=120)
    birth_date: date | None = None
    timezone: str = "UTC"
    coach_ids: list[UUID] = Field(default_factory=list)

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        return validate_phone(value)

    @field_validator("pin")
    @classmethod
    def check_pin(cls, value: str) -> str:
        return validate_pin(value)


class AdminAthleteUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    birth_date: date | None = None
    timezone: str | None = None
    is_active: bool | None = None
    pin: str | None = None
    coach_ids: list[UUID] | None = None

    @field_validator("pin")
    @classmethod
    def check_pin(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_pin(value)


class CoachAthleteLinkCreate(BaseModel):
    coach_id: UUID
    athlete_id: UUID
    status: CoachAthleteLinkStatus = CoachAthleteLinkStatus.active


class CoachAthleteLinkResponse(BaseModel):
    id: UUID
    coach_id: UUID
    athlete_id: UUID
    status: CoachAthleteLinkStatus
    created_at: datetime
