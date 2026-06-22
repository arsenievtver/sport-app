from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MealDishCandidate(BaseModel):
    logmeal_dish_id: int
    name: str
    name_en: str | None = None
    confidence: float | None = None


class MealDishPreview(BaseModel):
    name: str
    name_en: str | None = None
    logmeal_dish_id: int | None = None
    food_item_position: int | str | None = None
    confidence: float | None = None
    candidates: list[MealDishCandidate] = Field(default_factory=list)
    weight_g: float | None = None
    calories_kcal: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None


class MealDishSearchItem(BaseModel):
    logmeal_dish_id: int
    name: str
    name_en: str
    portion_size_g: float | None = None
    dish_type: str


class MealDishSearchResponse(BaseModel):
    items: list[MealDishSearchItem]
    catalog_synced_at: datetime | None = None
    catalog_dish_count: int = 0


class MealConfirmItem(BaseModel):
    food_item_position: int | str
    logmeal_dish_id: int


class MealConfirmRequest(BaseModel):
    logmeal_image_id: int
    segmentation: dict[str, Any]
    items: list[MealConfirmItem] = Field(min_length=1)


class MealAnalysisResponse(BaseModel):
    logmeal_image_id: int | None = None
    title: str
    calories_kcal: float
    weight_g: float | None = None
    weight_is_estimated: bool = False
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    logmeal_raw_calories_kcal: float | None = None
    baseline_weight_g: float | None = None
    baseline_calories_kcal: float | None = None
    baseline_protein_g: float | None = None
    baseline_carbs_g: float | None = None
    baseline_fat_g: float | None = None
    calories_derived_from_weight: bool = False
    dishes: list[MealDishPreview] = Field(default_factory=list)
    summary: str
    portion_note: str | None = None
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
