from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


CatalogJobStatus = Literal["idle", "running", "failed", "completed"]
CatalogJobType = Literal["none", "sync", "translate", "full"]


class MealCatalogJobState(BaseModel):
    status: CatalogJobStatus = "idle"
    job_type: CatalogJobType = "none"
    phase: str = ""
    current: int = 0
    total: int = 0
    message: str = ""
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class MealCatalogStats(BaseModel):
    dish_count: int = 0
    translated_count: int = 0
    untranslated_count: int = 0
    synced_at: datetime | None = None
    search_ready: bool = False
    translator_enabled: bool = False


class AdminMealCatalogStatusResponse(MealCatalogStats):
    job: MealCatalogJobState


class AdminMealCatalogDish(BaseModel):
    model_config = {"from_attributes": True}

    logmeal_id: int
    name_en: str
    name_ru: str | None = None
    portion_size_g: float | None = None
    dish_type: str
    created_at: datetime
    updated_at: datetime


class AdminMealCatalogDishListResponse(BaseModel):
    items: list[AdminMealCatalogDish]
    total: int
    page: int
    page_size: int


class AdminMealCatalogDishUpdate(BaseModel):
    name_ru: str | None = Field(default=None, max_length=500)
    portion_size_g: float | None = Field(default=None, ge=0, le=10000)
