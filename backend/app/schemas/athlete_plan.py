from datetime import date

from pydantic import BaseModel, Field

from app.models.enums import PlanActivityTier


class AthletePlanResponse(BaseModel):
    workouts_per_week: int
    activity_tier: PlanActivityTier
    sedentary_daily_kcal: float | None
    target_daily_kcal: float | None
    target_weekly_activity_min: int
    target_daily_activity_min: int
    current_weight_kg: float | None = None


class AthletePlanUpdateRequest(BaseModel):
    workouts_per_week: int | None = Field(default=None, ge=1, le=7)
    activity_tier: PlanActivityTier | None = None


class AthleteWeekProgressMetric(BaseModel):
    label: str
    actual: float
    target: float
    unit: str
    percent: int


class AthleteWeekProgressResponse(BaseModel):
    week_start: str
    week_end: str
    completion_percent: int
    workouts: AthleteWeekProgressMetric
    calories: AthleteWeekProgressMetric
    activity: AthleteWeekProgressMetric


class AthleteWorkoutWeeklyEntryResponse(BaseModel):
    week_start: date
    workouts_count: int
    other_activity_count: int = 0


class AthleteWorkoutWeeklyDynamicsResponse(BaseModel):
    entries: list[AthleteWorkoutWeeklyEntryResponse]
