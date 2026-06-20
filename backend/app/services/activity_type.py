from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_type import ActivityType
from app.models.user import AthleteProfile
from app.schemas.activity_type import ActivityTypeResponse, ActivityTypesListResponse


class ActivityTypeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_active(self) -> list[ActivityTypeResponse]:
        result = await self.db.execute(
            select(ActivityType)
            .where(ActivityType.is_active.is_(True))
            .order_by(ActivityType.sort_order, ActivityType.name_ru)
        )
        return [ActivityTypeResponse.model_validate(item) for item in result.scalars().all()]

    async def list_for_athlete(self, profile: AthleteProfile) -> ActivityTypesListResponse:
        items = await self.list_active()
        active_ids = {item.id for item in items}
        recent_ids: list[UUID] = []
        for raw_id in profile.recent_activity_type_ids or []:
            try:
                parsed = UUID(str(raw_id))
            except ValueError:
                continue
            if parsed in active_ids and parsed not in recent_ids:
                recent_ids.append(parsed)
        return ActivityTypesListResponse(items=items, recent_ids=recent_ids)

    async def list_all(self) -> ActivityTypesListResponse:
        items = await self.list_active()
        return ActivityTypesListResponse(items=items, recent_ids=[])
