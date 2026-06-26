from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityCompendiumJobState(BaseModel):
    status: str = "idle"
    job_type: str = "none"
    phase: str = ""
    current: int = 0
    total: int = 0
    message: str = ""
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ActivityCompendiumStats(BaseModel):
    activity_count: int = 0
    translated_count: int = 0
    untranslated_count: int = 0
    imported_at: datetime | None = None
    translator_enabled: bool = False
    major_headings: list[str] = Field(default_factory=list)
    major_heading_labels: dict[str, str] = Field(default_factory=dict)


class AdminActivityCompendiumStatusResponse(ActivityCompendiumStats):
    job: ActivityCompendiumJobState


class AdminActivityCompendiumItem(BaseModel):
    id: UUID
    compendium_code: str
    name_en: str
    name_ru: str
    major_heading: str | None
    met_value: float
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminActivityCompendiumListResponse(BaseModel):
    items: list[AdminActivityCompendiumItem]
    total: int
    page: int
    page_size: int


class AdminActivityCompendiumItemUpdate(BaseModel):
    major_heading: str | None = None
    name_en: str | None = None
    name_ru: str | None = None
    met_value: float | None = None
    is_active: bool | None = None


class AdminActivityCompendiumItemCreate(BaseModel):
    compendium_code: str
    major_heading: str
    name_en: str
    name_ru: str | None = None
    met_value: float
    is_active: bool = False


class AdminActivityCompendiumGroupRename(BaseModel):
    from_heading: str
    to_heading: str


class AdminActivityCompendiumGroupLabelUpdate(BaseModel):
    heading: str
    label_ru: str
