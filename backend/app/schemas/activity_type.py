from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import ActivityCategory


class ActivityTypeResponse(BaseModel):
    id: UUID
    compendium_code: str
    name_ru: str
    name_en: str
    major_heading: str | None = None
    category: ActivityCategory
    met_value: float
    sort_order: int

    model_config = {"from_attributes": True}


class ActivityTypesListResponse(BaseModel):
    items: list[ActivityTypeResponse]
    recent_ids: list[UUID] = []
    major_heading_labels: dict[str, str] = Field(default_factory=dict)
