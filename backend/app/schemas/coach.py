from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import CoachAthleteLinkStatus, Gender


class CoachAthleteSummary(BaseModel):
    athlete_id: UUID
    link_id: UUID
    display_name: str
    avatar_url: str | None = None
    link_status: CoachAthleteLinkStatus
    sessions_balance: int = 0
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
