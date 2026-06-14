from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import Gender

FOCUS_IMPORTANCE_MIN = 20
FOCUS_IMPORTANCE_MAX = 100


class AthleteOnboardingRequest(BaseModel):
    gender: Gender
    birth_date: date
    focus_strength: int = Field(ge=FOCUS_IMPORTANCE_MIN, le=FOCUS_IMPORTANCE_MAX)
    focus_flexibility: int = Field(ge=FOCUS_IMPORTANCE_MIN, le=FOCUS_IMPORTANCE_MAX)
    focus_endurance: int = Field(ge=FOCUS_IMPORTANCE_MIN, le=FOCUS_IMPORTANCE_MAX)
    focus_coordination: int = Field(ge=FOCUS_IMPORTANCE_MIN, le=FOCUS_IMPORTANCE_MAX)
    weight_target_min_kg: float | None = Field(default=None, ge=20, le=300)
    weight_target_max_kg: float | None = Field(default=None, ge=20, le=300)
    personal_goal_title: str | None = Field(default=None, max_length=200)
    personal_goal_target: float | None = Field(default=None, ge=0, le=1_000_000)

    @field_validator("birth_date")
    @classmethod
    def birth_date_in_past(cls, value: date) -> date:
        if value >= date.today():
            raise ValueError("birth_date must be in the past")
        return value

    @field_validator("personal_goal_title")
    @classmethod
    def normalize_goal_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_ranges(self) -> "AthleteOnboardingRequest":
        if (
            self.weight_target_min_kg is not None
            and self.weight_target_max_kg is not None
            and self.weight_target_min_kg > self.weight_target_max_kg
        ):
            raise ValueError("weight_target_min_kg must be <= weight_target_max_kg")

        has_title = self.personal_goal_title is not None
        has_target = self.personal_goal_target is not None
        if has_title and not has_target:
            raise ValueError("personal_goal_target required when personal_goal_title is set")
        if has_target and not has_title:
            raise ValueError("personal_goal_title required when personal_goal_target is set")

        return self


class AthleteProfileResponse(BaseModel):
    display_name: str
    gender: Gender | None = None
    birth_date: date | None = None
    timezone: str | None = None
    focus_strength: int | None = None
    focus_flexibility: int | None = None
    focus_endurance: int | None = None
    focus_coordination: int | None = None
    weight_target_min_kg: float | None = None
    weight_target_max_kg: float | None = None
    personal_goal_title: str | None = None
    personal_goal_target: float | None = None
    onboarding_completed_at: datetime | None = None

    model_config = {"from_attributes": True}
