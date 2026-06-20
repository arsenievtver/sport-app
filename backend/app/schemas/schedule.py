from datetime import date as Date
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class CoachScheduleSettingsResponse(BaseModel):
    work_days: list[int] = Field(description="0=Mon … 6=Sun")
    slot_start: str
    slot_end: str
    lunch_start: str | None = None
    lunch_end: str | None = None
    slot_duration_min: int
    timezone: str


class UpdateCoachScheduleSettingsRequest(BaseModel):
    work_days: list[int] = Field(min_length=1, max_length=7)
    slot_start: str
    slot_end: str
    lunch_start: str | None = None
    lunch_end: str | None = None
    slot_duration_min: int = Field(ge=15, le=240)
    timezone: str = Field(min_length=1, max_length=64)

    @field_validator("work_days")
    @classmethod
    def validate_work_days(cls, value: list[int]) -> list[int]:
        for day in value:
            if day < 0 or day > 6:
                raise ValueError("work_days: значение должно быть от 0 до 6")
        if len(set(value)) != len(value):
            raise ValueError("work_days: дни не должны повторяться")
        return sorted(value)


class ScheduleAthleteRef(BaseModel):
    athlete_id: UUID
    display_name: str
    avatar_url: str | None = None


class ScheduleDayColumn(BaseModel):
    day_of_week: int
    date: Date | None = None
    label: str


class ScheduleSlotCell(BaseModel):
    day_of_week: int
    date: Date | None = None
    start_time: str
    athlete: ScheduleAthleteRef | None = None
    activity_type_id: UUID | None = None
    activity_name: str | None = None
    is_exception: bool = False
    is_from_template: bool = False


class ScheduleGridResponse(BaseModel):
    mode: str
    week_start: Date | None = None
    week_end: Date | None = None
    settings: CoachScheduleSettingsResponse
    days: list[ScheduleDayColumn]
    time_slots: list[str]
    cells: list[ScheduleSlotCell]


class SetScheduleSlotRequest(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    athlete_id: UUID | None = None
    activity_type_id: UUID | None = None
    occurrence_date: Date | None = None

    @model_validator(mode="after")
    def validate_activity_with_athlete(self) -> "SetScheduleSlotRequest":
        if self.athlete_id is not None and self.activity_type_id is None:
            raise ValueError("Укажите вид тренировки")
        if self.athlete_id is None and self.activity_type_id is not None:
            raise ValueError("Вид тренировки указывается только при назначении атлета")
        return self


class MoveScheduleSlotRequest(BaseModel):
    from_date: Date
    from_time: str
    to_date: Date
    to_time: str


class AthleteUpcomingSessionResponse(BaseModel):
    coach_id: UUID
    coach_display_name: str
    coach_avatar_url: str | None = None
    occurrence_date: Date
    start_time: str
    duration_min: int
    activity_type_id: UUID | None = None
    activity_name: str | None = None


class ScheduleSlotCompletionResponse(BaseModel):
    athlete_id: UUID
    start_time: str
    activity_name: str | None = None
    effort: int | None = None


class CompleteScheduleSlotRequest(BaseModel):
    athlete_id: UUID
    occurrence_date: Date
    start_time: str
    activity_type_id: UUID
    effort: int = Field(ge=1, le=10)


class CompleteScheduleSlotResponse(BaseModel):
    athlete_id: UUID
    occurrence_date: Date
    start_time: str
    sessions_balance: int
    activity_name: str
    effort: int
