from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import CoachAthleteLinkStatus, Gender


class CoachAthleteSummary(BaseModel):
    athlete_id: UUID
    display_name: str
    link_status: CoachAthleteLinkStatus
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
