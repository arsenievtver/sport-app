from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class AthleteWeightEntryResponse(BaseModel):
    id: UUID
    entry_date: date
    weight_kg: float

    model_config = {"from_attributes": True}


class AthleteWeightDynamicsResponse(BaseModel):
    entries: list[AthleteWeightEntryResponse]
    current_weight_kg: float | None = None
    weight_target_min_kg: float | None = None
    weight_target_max_kg: float | None = None


class AthleteWeightMeasurementRequest(BaseModel):
    weight_kg: float = Field(ge=20, le=300)
