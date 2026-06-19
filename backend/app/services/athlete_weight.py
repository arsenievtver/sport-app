from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete_weight import AthleteWeightEntry
from app.models.user import AthleteProfile
from app.schemas.athlete_weight import (
    AthleteWeightDynamicsResponse,
    AthleteWeightEntryResponse,
    AthleteWeightMeasurementRequest,
)

WEIGHT_CHART_LIMIT = 10


def _athlete_today(profile: AthleteProfile) -> date:
    tz_name = profile.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


class AthleteWeightService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dynamics(self, profile: AthleteProfile) -> AthleteWeightDynamicsResponse:
        result = await self.db.execute(
            select(AthleteWeightEntry)
            .where(AthleteWeightEntry.athlete_id == profile.id)
            .order_by(AthleteWeightEntry.entry_date.desc())
            .limit(WEIGHT_CHART_LIMIT)
        )
        entries = list(reversed(result.scalars().all()))
        current = entries[-1].weight_kg if entries else None
        return AthleteWeightDynamicsResponse(
            entries=[AthleteWeightEntryResponse.model_validate(item) for item in entries],
            current_weight_kg=current,
            weight_target_min_kg=profile.weight_target_min_kg,
            weight_target_max_kg=profile.weight_target_max_kg,
        )

    async def add_measurement(
        self,
        profile: AthleteProfile,
        data: AthleteWeightMeasurementRequest,
    ) -> AthleteWeightDynamicsResponse:
        entry_date = _athlete_today(profile)
        result = await self.db.execute(
            select(AthleteWeightEntry).where(
                AthleteWeightEntry.athlete_id == profile.id,
                AthleteWeightEntry.entry_date == entry_date,
            )
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            entry = AthleteWeightEntry(
                athlete_id=profile.id,
                entry_date=entry_date,
                weight_kg=round(data.weight_kg, 1),
            )
            self.db.add(entry)
        else:
            entry.weight_kg = round(data.weight_kg, 1)
        await self.db.flush()
        return await self.get_dynamics(profile)

    async def get_current_weight_kg(self, profile: AthleteProfile) -> float | None:
        result = await self.db.execute(
            select(AthleteWeightEntry.weight_kg)
            .where(AthleteWeightEntry.athlete_id == profile.id)
            .order_by(AthleteWeightEntry.entry_date.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
