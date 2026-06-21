from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MealDishPreview(BaseModel):
    name: str
    confidence: float | None = None


class MealAnalysisResponse(BaseModel):
    logmeal_image_id: int | None = None
    title: str
    calories_kcal: float
    weight_g: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    dishes: list[MealDishPreview] = Field(default_factory=list)
    summary: str
    raw: dict[str, Any] = Field(default_factory=dict)


class AthleteMealEntryResponse(BaseModel):
    id: UUID
    entry_at: datetime
    calories_kcal: float
    title: str | None = None
    weight_g: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    source: Literal["manual", "ai"]
    logmeal_image_id: int | None = None
    ai_analysis: dict[str, Any] | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class AthleteMealListResponse(BaseModel):
    entries: list[AthleteMealEntryResponse]


class AthleteMealCreateRequest(BaseModel):
    entry_at: datetime | None = None
    title: str | None = Field(default=None, max_length=500)
    calories_kcal: float = Field(ge=0, le=10000)
    weight_g: float | None = Field(default=None, ge=0, le=10000)
    protein_g: float | None = Field(default=None, ge=0, le=1000)
    carbs_g: float | None = Field(default=None, ge=0, le=1000)
    fat_g: float | None = Field(default=None, ge=0, le=1000)
    source: Literal["manual", "ai"] = "manual"
    logmeal_image_id: int | None = None
    ai_analysis: dict[str, Any] | None = None
    notes: str | None = Field(default=None, max_length=2000)
