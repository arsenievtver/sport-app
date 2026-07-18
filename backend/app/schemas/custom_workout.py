from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CustomWorkoutIntervalInput(BaseModel):
    source_activity_type_id: UUID
    duration_min: int = Field(ge=5, le=600)
    label: str | None = Field(default=None, max_length=120)

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class CustomWorkoutCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    intervals: list[CustomWorkoutIntervalInput] = Field(min_length=1, max_length=40)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Укажите название тренировки")
        return trimmed


class CustomWorkoutUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    intervals: list[CustomWorkoutIntervalInput] = Field(min_length=1, max_length=40)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Укажите название тренировки")
        return trimmed


class CustomWorkoutIntervalResponse(BaseModel):
    id: UUID
    source_activity_type_id: UUID
    source_activity_name: str
    source_met_value: float
    duration_min: int
    sort_order: int
    label: str | None = None
    load_met_minutes: float

    model_config = {"from_attributes": True}


class CustomWorkoutResponse(BaseModel):
    id: UUID
    name: str
    average_met: float
    total_duration_min: int
    total_load_met_minutes: float
    intervals: list[CustomWorkoutIntervalResponse]
    coach_id: UUID | None = None
    coach_name: str | None = None

    model_config = {"from_attributes": True}
