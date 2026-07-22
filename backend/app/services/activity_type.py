from uuid import UUID

from sqlalchemy import nulls_last, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_type import ActivityType
from app.models.user import AthleteProfile, CoachProfile
from app.schemas.activity_type import ActivityTypeResponse, ActivityTypesListResponse
from app.services.activity_compendium import ActivityCompendiumService
from app.services.coach_custom_workout import CUSTOM_WORKOUT_HEADING_LABEL, CUSTOM_WORKOUT_MAJOR_HEADING


class ActivityTypeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_compendium_active(self) -> list[ActivityTypeResponse]:
        result = await self.db.execute(
            select(ActivityType)
            .where(
                ActivityType.is_active.is_(True),
                ActivityType.owner_coach_id.is_(None),
            )
            .order_by(nulls_last(ActivityType.major_heading.asc()), ActivityType.name_ru.asc())
        )
        return [ActivityTypeResponse.model_validate(item) for item in result.scalars().all()]

    async def list_for_athlete(self, profile: AthleteProfile) -> ActivityTypesListResponse:
        items = await self.list_compendium_active()
        active_ids = {item.id for item in items}
        recent_ids: list[UUID] = []
        for raw_id in profile.recent_activity_type_ids or []:
            try:
                parsed = UUID(str(raw_id))
            except ValueError:
                continue
            if parsed in active_ids and parsed not in recent_ids:
                recent_ids.append(parsed)
        return await self._build_list_response(items, recent_ids)

    async def list_for_coach(self, coach: CoachProfile) -> ActivityTypesListResponse:
        result = await self.db.execute(
            select(ActivityType)
            .where(
                ActivityType.is_active.is_(True),
                or_(
                    ActivityType.owner_coach_id.is_(None),
                    ActivityType.owner_coach_id == coach.id,
                ),
            )
            .order_by(
                # Coach custom workouts first, then Compendium by heading/name.
                ActivityType.owner_coach_id.is_(None).asc(),
                nulls_last(ActivityType.major_heading.asc()),
                ActivityType.name_ru.asc(),
            )
        )
        items = [ActivityTypeResponse.model_validate(item) for item in result.scalars().all()]
        return await self._build_list_response(items, [], include_custom_label=True)

    async def list_all(self) -> ActivityTypesListResponse:
        """Deprecated for coach: prefer list_for_coach. Compendium-only."""
        items = await self.list_compendium_active()
        return await self._build_list_response(items, [])

    async def _build_list_response(
        self,
        items: list[ActivityTypeResponse],
        recent_ids: list[UUID],
        *,
        include_custom_label: bool = False,
    ) -> ActivityTypesListResponse:
        labels = await ActivityCompendiumService(self.db).get_major_heading_labels()
        if include_custom_label:
            labels = {**labels, CUSTOM_WORKOUT_MAJOR_HEADING: CUSTOM_WORKOUT_HEADING_LABEL}
        return ActivityTypesListResponse(
            items=items,
            recent_ids=recent_ids,
            major_heading_labels=labels,
        )
