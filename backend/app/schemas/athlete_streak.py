from datetime import date

from pydantic import BaseModel, Field


class AthleteStreakMedalResponse(BaseModel):
    id: str
    title: str
    weeks_required: int
    unlocked: bool
    stack_count: int
    is_next: bool = False


class AthleteStreakResponse(BaseModel):
    current_streak_weeks: int
    best_streak_weeks: int
    workouts_per_week: int
    current_week_workouts: int
    current_week_met: bool
    next_threshold_weeks: int
    progress_weeks: int = Field(description="Weeks earned toward next_threshold")
    progress_percent: int
    medals_preview_unlock_all: bool
    medals: list[AthleteStreakMedalResponse]
    week_start: date
