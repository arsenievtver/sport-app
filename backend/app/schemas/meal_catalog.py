from datetime import datetime
from typing import Literal

from pydantic import BaseModel


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
