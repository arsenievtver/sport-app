from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.enums import CoachAthleteLinkStatus, CoachAthleteSessionEntryKind, Gender


class CreateManagedAthleteRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Имя не может быть пустым")
        return stripped


class CoachAthleteSummary(BaseModel):
    athlete_id: UUID
    link_id: UUID
    display_name: str
    has_app: bool = False
    avatar_url: str | None = None
    link_status: CoachAthleteLinkStatus
    sessions_balance: int = 0
    sessions_completed: int = 0
    gender: Gender | None = None
    birth_date: date | None = None
    focus_strength: int | None = None
    focus_flexibility: int | None = None
    focus_endurance: int | None = None
    focus_coordination: int | None = None
    weight_target_min_kg: float | None = None
    weight_target_max_kg: float | None = None
    personal_goal_title: str | None = None
    personal_goal_target: float | None = None
    onboarding_completed_at: datetime | None = None


class AddSessionsRequest(BaseModel):
    count: int = Field(ge=1, le=999)


class CoachAthleteSessionsResponse(BaseModel):
    athlete_id: UUID
    link_id: UUID
    sessions_balance: int
    sessions_completed: int


class CoachAthleteSessionHistoryEntry(BaseModel):
    id: UUID
    kind: CoachAthleteSessionEntryKind
    sessions_count: int
    entry_date: date


class CoachAthleteWeightMeasurementResponse(BaseModel):
    athlete_id: UUID
    entry_date: date
    weight_kg: float
