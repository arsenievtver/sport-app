from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity_type import ActivityType
from app.models.coach_workout_interval import CoachWorkoutInterval
from app.models.enums import ActivityCategory
from app.models.schedule import ScheduleTemplateSlot, ScheduleWeekException
from app.models.user import CoachProfile
from app.schemas.custom_workout import (
    CustomWorkoutCreateRequest,
    CustomWorkoutIntervalInput,
    CustomWorkoutIntervalResponse,
    CustomWorkoutResponse,
    CustomWorkoutUpdateRequest,
)

CUSTOM_WORKOUT_MAJOR_HEADING = "custom"
CUSTOM_WORKOUT_HEADING_LABEL = "Мои тренировки"


def calculate_weighted_average_met(
    intervals: list[tuple[float, int]],
) -> tuple[float, int, float]:
    """Return (average_met, total_duration_min, total_load_met_minutes)."""
    total_duration = sum(duration for _, duration in intervals)
    if total_duration <= 0:
        raise ValueError("Суммарная длительность должна быть больше нуля")
    total_load = sum(met * duration for met, duration in intervals)
    average_met = round(total_load / total_duration, 2)
    return average_met, total_duration, round(total_load, 1)


class CoachCustomWorkoutService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_coach(self, coach: CoachProfile) -> list[CustomWorkoutResponse]:
        result = await self.db.execute(
            select(ActivityType)
            .where(
                ActivityType.owner_coach_id == coach.id,
                ActivityType.is_active.is_(True),
            )
            .options(
                selectinload(ActivityType.workout_intervals).selectinload(
                    CoachWorkoutInterval.source_activity
                )
            )
            .order_by(ActivityType.name_ru.asc())
        )
        return [self._to_response(row) for row in result.scalars().unique().all()]

    async def create(
        self,
        coach: CoachProfile,
        data: CustomWorkoutCreateRequest,
    ) -> CustomWorkoutResponse:
        sources = await self._load_compendium_sources(data.intervals)
        average_met, _, _ = calculate_weighted_average_met(
            [(sources[item.source_activity_type_id].met_value, item.duration_min) for item in data.intervals]
        )
        workout_id = uuid4()
        activity = ActivityType(
            id=workout_id,
            compendium_code=f"custom:{workout_id}",
            name_ru=data.name,
            name_en=data.name,
            major_heading=CUSTOM_WORKOUT_MAJOR_HEADING,
            category=ActivityCategory.custom.value,
            met_value=average_met,
            sort_order=0,
            is_active=True,
            owner_coach_id=coach.id,
        )
        self.db.add(activity)
        await self.db.flush()
        await self._replace_intervals(activity, data.intervals, sources)
        await self.db.flush()
        return await self.get_for_coach(coach, activity.id)

    async def update(
        self,
        coach: CoachProfile,
        workout_id: UUID,
        data: CustomWorkoutUpdateRequest,
    ) -> CustomWorkoutResponse:
        activity = await self._get_owned_active(coach, workout_id, with_intervals=True)
        sources = await self._load_compendium_sources(data.intervals)
        average_met, _, _ = calculate_weighted_average_met(
            [(sources[item.source_activity_type_id].met_value, item.duration_min) for item in data.intervals]
        )
        activity.name_ru = data.name
        activity.name_en = data.name
        activity.met_value = average_met
        await self._replace_intervals(activity, data.intervals, sources)
        await self.db.flush()
        return await self.get_for_coach(coach, activity.id)

    async def delete(self, coach: CoachProfile, workout_id: UUID) -> None:
        activity = await self._get_owned_active(coach, workout_id)
        in_use = await self._is_referenced_in_schedule(activity.id)
        if in_use:
            activity.is_active = False
        else:
            await self.db.delete(activity)
        await self.db.flush()

    async def get_for_coach(self, coach: CoachProfile, workout_id: UUID) -> CustomWorkoutResponse:
        activity = await self._get_owned_active(coach, workout_id, with_intervals=True)
        return self._to_response(activity)

    async def list_all_for_admin(self) -> list[CustomWorkoutResponse]:
        result = await self.db.execute(
            select(ActivityType)
            .where(
                ActivityType.owner_coach_id.is_not(None),
                ActivityType.is_active.is_(True),
            )
            .options(
                selectinload(ActivityType.workout_intervals).selectinload(
                    CoachWorkoutInterval.source_activity
                ),
                selectinload(ActivityType.owner_coach),
            )
            .order_by(ActivityType.name_ru.asc())
        )
        return [self._to_response(row) for row in result.scalars().unique().all()]

    async def _get_owned_active(
        self,
        coach: CoachProfile,
        workout_id: UUID,
        *,
        with_intervals: bool = False,
    ) -> ActivityType:
        stmt = select(ActivityType).where(
            ActivityType.id == workout_id,
            ActivityType.owner_coach_id == coach.id,
            ActivityType.is_active.is_(True),
        )
        if with_intervals:
            stmt = stmt.options(
                selectinload(ActivityType.workout_intervals).selectinload(
                    CoachWorkoutInterval.source_activity
                )
            )
        result = await self.db.execute(stmt)
        activity = result.scalar_one_or_none()
        if activity is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Тренировка не найдена",
            )
        return activity

    async def _load_compendium_sources(
        self,
        intervals: list[CustomWorkoutIntervalInput],
    ) -> dict[UUID, ActivityType]:
        source_ids = {item.source_activity_type_id for item in intervals}
        result = await self.db.execute(
            select(ActivityType).where(
                ActivityType.id.in_(source_ids),
                ActivityType.is_active.is_(True),
                ActivityType.owner_coach_id.is_(None),
            )
        )
        sources = {row.id: row for row in result.scalars().all()}
        missing = source_ids - sources.keys()
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Интервал должен ссылаться на активность из справочника",
            )
        return sources

    async def _replace_intervals(
        self,
        activity: ActivityType,
        intervals: list[CustomWorkoutIntervalInput],
        sources: dict[UUID, ActivityType],
    ) -> None:
        activity.workout_intervals.clear()
        await self.db.flush()
        for index, item in enumerate(intervals):
            activity.workout_intervals.append(
                CoachWorkoutInterval(
                    activity_type_id=activity.id,
                    source_activity_type_id=item.source_activity_type_id,
                    duration_min=item.duration_min,
                    sort_order=index,
                    label=item.label,
                )
            )
            _ = sources[item.source_activity_type_id]

    async def _is_referenced_in_schedule(self, activity_type_id: UUID) -> bool:
        template = await self.db.execute(
            select(func.count())
            .select_from(ScheduleTemplateSlot)
            .where(ScheduleTemplateSlot.activity_type_id == activity_type_id)
        )
        if (template.scalar_one() or 0) > 0:
            return True
        exception = await self.db.execute(
            select(func.count())
            .select_from(ScheduleWeekException)
            .where(ScheduleWeekException.activity_type_id == activity_type_id)
        )
        return (exception.scalar_one() or 0) > 0

    def _to_response(self, activity: ActivityType) -> CustomWorkoutResponse:
        intervals: list[CustomWorkoutIntervalResponse] = []
        met_durations: list[tuple[float, int]] = []
        for item in activity.workout_intervals:
            source = item.source_activity
            source_met = source.met_value if source is not None else 0.0
            source_name = source.name_ru if source is not None else "—"
            load = round(source_met * item.duration_min, 1)
            met_durations.append((source_met, item.duration_min))
            intervals.append(
                CustomWorkoutIntervalResponse(
                    id=item.id,
                    source_activity_type_id=item.source_activity_type_id,
                    source_activity_name=source_name,
                    source_met_value=source_met,
                    duration_min=item.duration_min,
                    sort_order=item.sort_order,
                    label=item.label,
                    load_met_minutes=load,
                )
            )
        if met_durations:
            average_met, total_duration, total_load = calculate_weighted_average_met(met_durations)
        else:
            average_met, total_duration, total_load = activity.met_value, 0, 0.0
        coach = activity.owner_coach
        return CustomWorkoutResponse(
            id=activity.id,
            name=activity.name_ru,
            average_met=average_met,
            total_duration_min=total_duration,
            total_load_met_minutes=total_load,
            intervals=intervals,
            coach_id=activity.owner_coach_id,
            coach_name=coach.display_name if coach is not None else None,
        )
