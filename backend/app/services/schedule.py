from __future__ import annotations

from datetime import date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity_type import ActivityType
from app.models.enums import CoachAthleteLinkStatus, CoachAthleteSessionEntryKind
from app.models.schedule import CoachScheduleSettings, ScheduleSlotCompletion, ScheduleTemplateSlot, ScheduleWeekException
from app.models.session_ledger import CoachAthleteSessionEntry
from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile
from app.schemas.schedule import (
    AthleteUpcomingSessionResponse,
    CoachScheduleSettingsResponse,
    CompleteScheduleSlotRequest,
    CompleteScheduleSlotResponse,
    MoveScheduleSlotRequest,
    ScheduleAthleteRef,
    ScheduleDayColumn,
    ScheduleGridResponse,
    ScheduleSlotCell,
    ScheduleSlotCompletionResponse,
    SetScheduleSlotRequest,
    UpdateCoachScheduleSettingsRequest,
)
from app.services.activity_load import (
    calculate_effective_met,
    calculate_load_met_minutes,
    calculate_workout_calories,
    clamp_activity_effort,
)
from app.services.athlete_weight import AthleteWeightService

DAY_LABELS = ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")

DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4]
DEFAULT_SLOT_START = time(14, 0)
DEFAULT_SLOT_END = time(20, 0)
DEFAULT_LUNCH_START = time(13, 0)
DEFAULT_LUNCH_END = time(14, 0)


def _parse_time(value: str) -> time:
    parts = value.strip().split(":")
    if len(parts) < 2 or len(parts) > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный формат времени")
    hour, minute = int(parts[0]), int(parts[1])
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверное время")
    return time(hour, minute)


def _format_time(value: time) -> str:
    return value.strftime("%H:%M")


def _time_to_minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def _minutes_to_time(total: int) -> time:
    return time(total // 60, total % 60)


def _monday_of_week(value: date) -> date:
    return value - timedelta(days=value.weekday())


class ScheduleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_settings(self, coach_profile: CoachProfile) -> CoachScheduleSettingsResponse:
        settings = await self._get_or_create_settings(coach_profile)
        return self._settings_to_response(settings)

    async def update_settings(
        self,
        coach_profile: CoachProfile,
        data: UpdateCoachScheduleSettingsRequest,
    ) -> CoachScheduleSettingsResponse:
        slot_start = _parse_time(data.slot_start)
        slot_end = _parse_time(data.slot_end)
        if slot_start >= slot_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Начало рабочего дня должно быть раньше конца",
            )

        lunch_start = _parse_time(data.lunch_start) if data.lunch_start else None
        lunch_end = _parse_time(data.lunch_end) if data.lunch_end else None
        if (lunch_start is None) != (lunch_end is None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите оба времени обеда или оставьте пустыми",
            )
        if lunch_start and lunch_end and lunch_start >= lunch_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Начало обеда должно быть раньше конца",
            )

        settings = await self._get_or_create_settings(coach_profile)
        settings.work_days = data.work_days
        settings.slot_start = slot_start
        settings.slot_end = slot_end
        settings.lunch_start = lunch_start
        settings.lunch_end = lunch_end
        settings.slot_duration_min = data.slot_duration_min
        settings.timezone = data.timezone.strip()
        await self.db.flush()
        return self._settings_to_response(settings)

    async def get_template_grid(self, coach_profile: CoachProfile) -> ScheduleGridResponse:
        settings = await self._get_or_create_settings(coach_profile)
        template_slots = await self._load_template_slots(coach_profile)
        athlete_map = await self._load_athlete_map(coach_profile)

        days = self._build_template_days(settings)
        time_slots = self._build_time_slots(settings)
        cells = self._build_template_cells(days, time_slots, template_slots, athlete_map)
        return ScheduleGridResponse(
            mode="template",
            settings=self._settings_to_response(settings),
            days=days,
            time_slots=time_slots,
            cells=cells,
        )

    async def get_week_grid(self, coach_profile: CoachProfile, week_date: date) -> ScheduleGridResponse:
        settings = await self._get_or_create_settings(coach_profile)
        week_start = _monday_of_week(week_date)
        week_end = week_start + timedelta(days=6)

        template_slots = await self._load_template_slots(coach_profile)
        exceptions = await self._load_week_exceptions(coach_profile, week_start, week_end)
        athlete_map = await self._load_athlete_map(coach_profile)

        days = self._build_week_days(settings, week_start)
        time_slots = self._build_time_slots(settings)
        cells = self._build_week_cells(
            days,
            time_slots,
            template_slots,
            exceptions,
            athlete_map,
        )
        return ScheduleGridResponse(
            mode="week",
            week_start=week_start,
            week_end=week_end,
            settings=self._settings_to_response(settings),
            days=days,
            time_slots=time_slots,
            cells=cells,
        )

    async def set_slot(
        self,
        coach_profile: CoachProfile,
        data: SetScheduleSlotRequest,
    ) -> ScheduleGridResponse:
        settings = await self._get_or_create_settings(coach_profile)
        start_time = _parse_time(data.start_time)
        self._ensure_slot_in_grid(settings, data.day_of_week, start_time)

        if data.athlete_id is not None:
            await self._ensure_athlete_belongs_to_coach(coach_profile, data.athlete_id)
            await self._ensure_activity_type(data.activity_type_id, coach_profile)

        if data.occurrence_date is None:
            if data.athlete_id is not None:
                await self._ensure_no_template_athlete_conflict(
                    coach_profile,
                    data.day_of_week,
                    start_time,
                    data.athlete_id,
                )
            await self._set_template_slot(
                coach_profile,
                data.day_of_week,
                start_time,
                data.athlete_id,
                data.activity_type_id,
            )
            return await self.get_template_grid(coach_profile)

        if data.occurrence_date.weekday() != data.day_of_week:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="День недели не совпадает с датой",
            )

        template_slots = await self._load_template_slots(coach_profile)
        week_start = _monday_of_week(data.occurrence_date)
        week_end = week_start + timedelta(days=6)
        exceptions = await self._load_week_exceptions(coach_profile, week_start, week_end)

        if data.athlete_id is not None:
            await self._ensure_no_week_athlete_conflict(
                coach_profile,
                data.occurrence_date,
                start_time,
                data.athlete_id,
                settings,
                template_slots,
                exceptions,
            )

        await self._set_week_exception(
            coach_profile,
            data.occurrence_date,
            start_time,
            data.athlete_id,
            data.activity_type_id,
        )
        return await self.get_week_grid(coach_profile, data.occurrence_date)

    async def clear_week_slot(
        self,
        coach_profile: CoachProfile,
        occurrence_date: date,
        start_time_str: str,
    ) -> ScheduleGridResponse:
        start_time = _parse_time(start_time_str)
        await self.db.execute(
            delete(ScheduleWeekException).where(
                ScheduleWeekException.coach_id == coach_profile.id,
                ScheduleWeekException.occurrence_date == occurrence_date,
                ScheduleWeekException.start_time == start_time,
            )
        )
        await self.db.flush()
        return await self.get_week_grid(coach_profile, occurrence_date)

    async def move_week_slot(
        self,
        coach_profile: CoachProfile,
        data: MoveScheduleSlotRequest,
    ) -> ScheduleGridResponse:
        settings = await self._get_or_create_settings(coach_profile)
        from_time = _parse_time(data.from_time)
        to_time = _parse_time(data.to_time)

        week_start = _monday_of_week(data.from_date)
        week_end = week_start + timedelta(days=6)
        template_slots = await self._load_template_slots(coach_profile)
        exceptions = await self._load_week_exceptions(coach_profile, week_start, week_end)
        athlete_map = await self._load_athlete_map(coach_profile)

        from_cell = self._resolve_week_cell(
            data.from_date,
            from_time,
            template_slots,
            exceptions,
            athlete_map,
        )
        if from_cell.athlete is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Исходный слот пуст")

        to_day = data.to_date.weekday()
        self._ensure_slot_in_grid(settings, to_day, to_time)

        to_cell = self._resolve_week_cell(
            data.to_date,
            to_time,
            template_slots,
            exceptions,
            athlete_map,
        )
        if to_cell.athlete is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Целевой слот занят")

        athlete_id = from_cell.athlete.athlete_id
        activity_type_id = from_cell.activity_type_id

        await self._set_week_exception(coach_profile, data.from_date, from_time, None, None)
        await self._set_week_exception(
            coach_profile,
            data.to_date,
            to_time,
            athlete_id,
            activity_type_id,
        )

        return await self.get_week_grid(coach_profile, data.from_date)

    async def list_upcoming_for_athlete(
        self,
        athlete_profile: AthleteProfile,
        days: int = 1,
        horizon_days: int = 56,
    ) -> list[AthleteUpcomingSessionResponse]:
        result = await self.db.execute(
            select(CoachAthleteLink)
            .where(
                CoachAthleteLink.athlete_id == athlete_profile.id,
                CoachAthleteLink.status == CoachAthleteLinkStatus.active,
            )
            .options(selectinload(CoachAthleteLink.coach))
        )
        links = result.scalars().all()

        candidates: list[tuple[datetime, AthleteUpcomingSessionResponse]] = []

        for link in links:
            coach = link.coach
            settings = await self._load_settings(coach)
            if settings is None:
                continue

            template_slots = await self._load_template_slots(coach)
            tz_name = settings.timezone or "Europe/Moscow"
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = ZoneInfo("Europe/Moscow")

            today = datetime.now(tz).date()
            range_end = today + timedelta(days=horizon_days)
            exceptions = await self._load_week_exceptions(coach, today, range_end)
            athlete_map = await self._load_athlete_map(coach)
            time_slots = self._build_time_slots(settings)

            current = today
            while current <= range_end:
                if current.weekday() not in settings.work_days:
                    current += timedelta(days=1)
                    continue

                for slot_str in time_slots:
                    slot_time = _parse_time(slot_str)
                    cell = self._resolve_week_cell(
                        current,
                        slot_time,
                        template_slots,
                        exceptions,
                        athlete_map,
                    )
                    if cell.athlete is None or cell.athlete.athlete_id != athlete_profile.id:
                        continue

                    slot_dt = datetime.combine(current, slot_time, tzinfo=tz)
                    if slot_dt < datetime.now(tz):
                        continue

                    session = AthleteUpcomingSessionResponse(
                        coach_id=coach.id,
                        coach_display_name=coach.display_name,
                        coach_avatar_url=coach.avatar_url,
                        sessions_balance=link.sessions_balance,
                        occurrence_date=current,
                        start_time=slot_str,
                        duration_min=settings.slot_duration_min,
                        activity_type_id=cell.activity_type_id,
                        activity_name=cell.activity_name,
                    )
                    candidates.append((slot_dt, session))

                current += timedelta(days=1)

        candidates.sort(key=lambda item: item[0])
        if not candidates:
            return []

        first_date = candidates[0][1].occurrence_date
        last_date = first_date + timedelta(days=max(days, 1) - 1)
        return [
            session
            for _, session in candidates
            if first_date <= session.occurrence_date <= last_date
        ]

    async def _load_settings(self, coach_profile: CoachProfile) -> CoachScheduleSettings | None:
        result = await self.db.execute(
            select(CoachScheduleSettings).where(
                CoachScheduleSettings.coach_id == coach_profile.id,
            )
        )
        return result.scalar_one_or_none()

    async def _get_or_create_settings(self, coach_profile: CoachProfile) -> CoachScheduleSettings:
        result = await self.db.execute(
            select(CoachScheduleSettings).where(CoachScheduleSettings.coach_id == coach_profile.id)
        )
        settings = result.scalar_one_or_none()
        if settings is not None:
            return settings

        settings = CoachScheduleSettings(
            coach_id=coach_profile.id,
            work_days=DEFAULT_WORK_DAYS,
            slot_start=DEFAULT_SLOT_START,
            slot_end=DEFAULT_SLOT_END,
            lunch_start=DEFAULT_LUNCH_START,
            lunch_end=DEFAULT_LUNCH_END,
            slot_duration_min=60,
            timezone="Europe/Moscow",
        )
        self.db.add(settings)
        await self.db.flush()
        return settings

    async def _load_template_slots(
        self,
        coach_profile: CoachProfile,
    ) -> dict[tuple[int, time], ScheduleTemplateSlot]:
        result = await self.db.execute(
            select(ScheduleTemplateSlot)
            .where(ScheduleTemplateSlot.coach_id == coach_profile.id)
            .options(
                selectinload(ScheduleTemplateSlot.athlete),
                selectinload(ScheduleTemplateSlot.activity_type),
            )
        )
        slots = result.scalars().all()
        return {(slot.day_of_week, slot.start_time): slot for slot in slots}

    async def _load_week_exceptions(
        self,
        coach_profile: CoachProfile,
        week_start: date,
        week_end: date,
    ) -> dict[tuple[date, time], ScheduleWeekException]:
        result = await self.db.execute(
            select(ScheduleWeekException)
            .where(
                ScheduleWeekException.coach_id == coach_profile.id,
                ScheduleWeekException.occurrence_date >= week_start,
                ScheduleWeekException.occurrence_date <= week_end,
            )
            .options(
                selectinload(ScheduleWeekException.athlete),
                selectinload(ScheduleWeekException.activity_type),
            )
        )
        items = result.scalars().all()
        return {(item.occurrence_date, item.start_time): item for item in items}

    async def _load_athlete_map(self, coach_profile: CoachProfile) -> dict[UUID, AthleteProfile]:
        result = await self.db.execute(
            select(AthleteProfile)
            .join(CoachAthleteLink, CoachAthleteLink.athlete_id == AthleteProfile.id)
            .where(
                CoachAthleteLink.coach_id == coach_profile.id,
                CoachAthleteLink.status == CoachAthleteLinkStatus.active,
            )
        )
        athletes = result.scalars().all()
        return {athlete.id: athlete for athlete in athletes}

    async def _ensure_athlete_belongs_to_coach(self, coach_profile: CoachProfile, athlete_id: UUID) -> None:
        result = await self.db.execute(
            select(CoachAthleteLink.id).where(
                CoachAthleteLink.coach_id == coach_profile.id,
                CoachAthleteLink.athlete_id == athlete_id,
                CoachAthleteLink.status == CoachAthleteLinkStatus.active,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Атлет не найден")

    async def _ensure_activity_type(
        self,
        activity_type_id: UUID | None,
        coach_profile: CoachProfile | None = None,
    ) -> None:
        if activity_type_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите вид тренировки",
            )
        conditions = [
            ActivityType.id == activity_type_id,
            ActivityType.is_active.is_(True),
        ]
        if coach_profile is not None:
            conditions.append(
                or_(
                    ActivityType.owner_coach_id.is_(None),
                    ActivityType.owner_coach_id == coach_profile.id,
                )
            )
        else:
            conditions.append(ActivityType.owner_coach_id.is_(None))
        result = await self.db.execute(select(ActivityType.id).where(*conditions))
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Вид тренировки не найден",
            )

    def _activity_fields_from_slot(
        self,
        activity_type_id: UUID | None,
        activity_type: ActivityType | None,
    ) -> tuple[UUID | None, str | None]:
        if activity_type_id is None:
            return None, None
        if activity_type is not None:
            return activity_type.id, activity_type.name_ru
        return activity_type_id, None

    def _settings_to_response(self, settings: CoachScheduleSettings) -> CoachScheduleSettingsResponse:
        return CoachScheduleSettingsResponse(
            work_days=list(settings.work_days),
            slot_start=_format_time(settings.slot_start),
            slot_end=_format_time(settings.slot_end),
            lunch_start=_format_time(settings.lunch_start) if settings.lunch_start else None,
            lunch_end=_format_time(settings.lunch_end) if settings.lunch_end else None,
            slot_duration_min=settings.slot_duration_min,
            timezone=settings.timezone,
        )

    def _build_time_slots(self, settings: CoachScheduleSettings) -> list[str]:
        slots: list[str] = []
        start_min = _time_to_minutes(settings.slot_start)
        end_min = _time_to_minutes(settings.slot_end)
        lunch_start = _time_to_minutes(settings.lunch_start) if settings.lunch_start else None
        lunch_end = _time_to_minutes(settings.lunch_end) if settings.lunch_end else None

        current = start_min
        while current + settings.slot_duration_min <= end_min:
            slot_end = current + settings.slot_duration_min
            overlaps_lunch = (
                lunch_start is not None
                and lunch_end is not None
                and current < lunch_end
                and slot_end > lunch_start
            )
            if not overlaps_lunch:
                slots.append(_format_time(_minutes_to_time(current)))
            current += settings.slot_duration_min
        return slots

    def _build_template_days(self, settings: CoachScheduleSettings) -> list[ScheduleDayColumn]:
        return [
            ScheduleDayColumn(day_of_week=day, label=DAY_LABELS[day])
            for day in settings.work_days
        ]

    def _build_week_days(self, settings: CoachScheduleSettings, week_start: date) -> list[ScheduleDayColumn]:
        days: list[ScheduleDayColumn] = []
        for offset in range(7):
            current = week_start + timedelta(days=offset)
            if current.weekday() not in settings.work_days:
                continue
            days.append(
                ScheduleDayColumn(
                    day_of_week=current.weekday(),
                    date=current,
                    label=f"{DAY_LABELS[current.weekday()]} {current.day:02d}",
                )
            )
        return days

    def _build_template_cells(
        self,
        days: list[ScheduleDayColumn],
        time_slots: list[str],
        template_slots: dict[tuple[int, time], ScheduleTemplateSlot],
        athlete_map: dict[UUID, AthleteProfile],
    ) -> list[ScheduleSlotCell]:
        cells: list[ScheduleSlotCell] = []
        for day in days:
            for slot_str in time_slots:
                slot_time = _parse_time(slot_str)
                template = template_slots.get((day.day_of_week, slot_time))
                athlete_ref = None
                activity_type_id = None
                activity_name = None
                if template and template.athlete_id:
                    athlete_ref = self._athlete_to_ref(template.athlete_id, athlete_map, template.athlete)
                    activity_type_id, activity_name = self._activity_fields_from_slot(
                        template.activity_type_id,
                        template.activity_type,
                    )
                cells.append(
                    ScheduleSlotCell(
                        day_of_week=day.day_of_week,
                        start_time=slot_str,
                        athlete=athlete_ref,
                        activity_type_id=activity_type_id,
                        activity_name=activity_name,
                        is_exception=False,
                        is_from_template=athlete_ref is not None,
                    )
                )
        return cells

    def _build_week_cells(
        self,
        days: list[ScheduleDayColumn],
        time_slots: list[str],
        template_slots: dict[tuple[int, time], ScheduleTemplateSlot],
        exceptions: dict[tuple[date, time], ScheduleWeekException],
        athlete_map: dict[UUID, AthleteProfile],
    ) -> list[ScheduleSlotCell]:
        cells: list[ScheduleSlotCell] = []
        for day in days:
            assert day.date is not None
            for slot_str in time_slots:
                slot_time = _parse_time(slot_str)
                cell = self._resolve_week_cell(
                    day.date,
                    slot_time,
                    template_slots,
                    exceptions,
                    athlete_map,
                )
                cells.append(cell)
        return cells

    def _resolve_week_cell(
        self,
        occurrence_date: date,
        start_time: time,
        template_slots: dict[tuple[int, time], ScheduleTemplateSlot],
        exceptions: dict[tuple[date, time], ScheduleWeekException],
        athlete_map: dict[UUID, AthleteProfile],
    ) -> ScheduleSlotCell:
        day_of_week = occurrence_date.weekday()
        slot_str = _format_time(start_time)
        exception = exceptions.get((occurrence_date, start_time))
        if exception is not None:
            athlete_ref = None
            activity_type_id = None
            activity_name = None
            if exception.athlete_id:
                athlete_ref = self._athlete_to_ref(exception.athlete_id, athlete_map, exception.athlete)
                activity_type_id, activity_name = self._activity_fields_from_slot(
                    exception.activity_type_id,
                    exception.activity_type,
                )
            return ScheduleSlotCell(
                day_of_week=day_of_week,
                date=occurrence_date,
                start_time=slot_str,
                athlete=athlete_ref,
                activity_type_id=activity_type_id,
                activity_name=activity_name,
                is_exception=True,
                is_from_template=False,
            )

        template = template_slots.get((day_of_week, start_time))
        athlete_ref = None
        activity_type_id = None
        activity_name = None
        if template and template.athlete_id:
            athlete_ref = self._athlete_to_ref(template.athlete_id, athlete_map, template.athlete)
            activity_type_id, activity_name = self._activity_fields_from_slot(
                template.activity_type_id,
                template.activity_type,
            )
        return ScheduleSlotCell(
            day_of_week=day_of_week,
            date=occurrence_date,
            start_time=slot_str,
            athlete=athlete_ref,
            activity_type_id=activity_type_id,
            activity_name=activity_name,
            is_exception=False,
            is_from_template=athlete_ref is not None,
        )

    def _athlete_to_ref(
        self,
        athlete_id: UUID,
        athlete_map: dict[UUID, AthleteProfile],
        loaded: AthleteProfile | None,
    ) -> ScheduleAthleteRef | None:
        athlete = loaded or athlete_map.get(athlete_id)
        if athlete is None:
            return None
        return ScheduleAthleteRef(
            athlete_id=athlete.id,
            display_name=athlete.display_name,
            avatar_url=athlete.avatar_url,
        )

    def _ensure_slot_in_grid(self, settings: CoachScheduleSettings, day_of_week: int, start_time: time) -> None:
        if day_of_week not in settings.work_days:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="День не в рабочих днях")
        if _format_time(start_time) not in self._build_time_slots(settings):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Слот вне рабочего окна")

    async def _set_template_slot(
        self,
        coach_profile: CoachProfile,
        day_of_week: int,
        start_time: time,
        athlete_id: UUID | None,
        activity_type_id: UUID | None = None,
    ) -> None:
        result = await self.db.execute(
            select(ScheduleTemplateSlot).where(
                ScheduleTemplateSlot.coach_id == coach_profile.id,
                ScheduleTemplateSlot.day_of_week == day_of_week,
                ScheduleTemplateSlot.start_time == start_time,
            )
        )
        slot = result.scalar_one_or_none()
        if athlete_id is None:
            if slot is not None:
                await self.db.delete(slot)
            return
        if slot is None:
            slot = ScheduleTemplateSlot(
                coach_id=coach_profile.id,
                day_of_week=day_of_week,
                start_time=start_time,
                athlete_id=athlete_id,
                activity_type_id=activity_type_id,
            )
            self.db.add(slot)
        else:
            slot.athlete_id = athlete_id
            slot.activity_type_id = activity_type_id
        await self.db.flush()

    async def _set_week_exception(
        self,
        coach_profile: CoachProfile,
        occurrence_date: date,
        start_time: time,
        athlete_id: UUID | None,
        activity_type_id: UUID | None = None,
    ) -> None:
        result = await self.db.execute(
            select(ScheduleWeekException).where(
                ScheduleWeekException.coach_id == coach_profile.id,
                ScheduleWeekException.occurrence_date == occurrence_date,
                ScheduleWeekException.start_time == start_time,
            )
        )
        exception = result.scalar_one_or_none()
        if exception is None:
            exception = ScheduleWeekException(
                coach_id=coach_profile.id,
                occurrence_date=occurrence_date,
                start_time=start_time,
                athlete_id=athlete_id,
                activity_type_id=activity_type_id,
            )
            self.db.add(exception)
        else:
            exception.athlete_id = athlete_id
            exception.activity_type_id = activity_type_id
        await self.db.flush()

    async def _ensure_no_template_athlete_conflict(
        self,
        coach_profile: CoachProfile,
        day_of_week: int,
        start_time: time,
        athlete_id: UUID | None,
    ) -> None:
        if athlete_id is None:
            return
        result = await self.db.execute(
            select(ScheduleTemplateSlot).where(
                ScheduleTemplateSlot.coach_id == coach_profile.id,
                ScheduleTemplateSlot.day_of_week == day_of_week,
                ScheduleTemplateSlot.athlete_id == athlete_id,
                ScheduleTemplateSlot.start_time != start_time,
            )
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Атлет уже назначен на этот день в другое время",
            )

    async def _ensure_no_week_athlete_conflict(
        self,
        coach_profile: CoachProfile,
        occurrence_date: date,
        start_time: time,
        athlete_id: UUID | None,
        settings: CoachScheduleSettings,
        template_slots: dict[tuple[int, time], ScheduleTemplateSlot],
        exceptions: dict[tuple[date, time], ScheduleWeekException],
        athlete_map: dict[UUID, AthleteProfile] | None = None,
    ) -> None:
        if athlete_id is None:
            return
        time_slots = self._build_time_slots(settings)
        for slot_str in time_slots:
            slot_time = _parse_time(slot_str)
            if slot_time == start_time:
                continue
            cell = self._resolve_week_cell(
                occurrence_date,
                slot_time,
                template_slots,
                exceptions,
                athlete_map or {},
            )
            if cell.athlete and cell.athlete.athlete_id == athlete_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Атлет уже назначен на этот день в другое время",
                )

    async def list_day_completions(
        self,
        coach_profile: CoachProfile,
        occurrence_date: date,
    ) -> list[ScheduleSlotCompletionResponse]:
        result = await self.db.execute(
            select(ScheduleSlotCompletion)
            .where(
                ScheduleSlotCompletion.coach_id == coach_profile.id,
                ScheduleSlotCompletion.occurrence_date == occurrence_date,
            )
            .options(
                selectinload(ScheduleSlotCompletion.session_entry).selectinload(
                    CoachAthleteSessionEntry.activity_type
                )
            )
        )
        items = result.scalars().all()
        responses: list[ScheduleSlotCompletionResponse] = []
        for item in items:
            entry = item.session_entry
            activity_name = entry.activity_type.name_ru if entry.activity_type else None
            responses.append(
                ScheduleSlotCompletionResponse(
                    athlete_id=item.athlete_id,
                    start_time=_format_time(item.start_time),
                    activity_name=activity_name,
                    effort=entry.effort,
                )
            )
        return responses

    async def complete_schedule_slot(
        self,
        coach_profile: CoachProfile,
        data: CompleteScheduleSlotRequest,
    ) -> CompleteScheduleSlotResponse:
        start_time = _parse_time(data.start_time)
        existing = await self.db.execute(
            select(ScheduleSlotCompletion).where(
                ScheduleSlotCompletion.coach_id == coach_profile.id,
                ScheduleSlotCompletion.athlete_id == data.athlete_id,
                ScheduleSlotCompletion.occurrence_date == data.occurrence_date,
                ScheduleSlotCompletion.start_time == start_time,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Тренировка уже завершена",
            )

        grid = await self.get_week_grid(coach_profile, data.occurrence_date)
        slot_cell = next(
            (
                cell
                for cell in grid.cells
                if cell.date == data.occurrence_date
                and cell.start_time == data.start_time
                and cell.athlete is not None
                and cell.athlete.athlete_id == data.athlete_id
            ),
            None,
        )
        if slot_cell is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Слот расписания не найден",
            )

        link = await self._get_coach_athlete_link(coach_profile, data.athlete_id)
        await self._ensure_activity_type(data.activity_type_id, coach_profile)
        activity_result = await self.db.execute(
            select(ActivityType).where(ActivityType.id == data.activity_type_id)
        )
        activity_type = activity_result.scalar_one()
        effort = clamp_activity_effort(data.effort)
        duration_min = grid.settings.slot_duration_min
        effective_met = calculate_effective_met(activity_type.met_value, effort)
        load_met_minutes = calculate_load_met_minutes(activity_type.met_value, duration_min, effort)

        await self.db.refresh(link, attribute_names=["athlete"])
        weight_kg = await AthleteWeightService(self.db).get_current_weight_kg(link.athlete)
        calories_kcal = (
            calculate_workout_calories(effective_met, duration_min, weight_kg)
            if weight_kg is not None
            else None
        )

        link.sessions_balance -= 1
        entry = CoachAthleteSessionEntry(
            link_id=link.id,
            kind=CoachAthleteSessionEntryKind.debit,
            sessions_count=1,
            entry_date=data.occurrence_date,
            activity_type_id=activity_type.id,
            duration_min=duration_min,
            effort=effort,
            effective_met=effective_met,
            load_met_minutes=load_met_minutes,
            weight_kg_used=weight_kg,
            calories_kcal=calories_kcal,
        )
        self.db.add(entry)
        await self.db.flush()

        completion = ScheduleSlotCompletion(
            coach_id=coach_profile.id,
            athlete_id=data.athlete_id,
            occurrence_date=data.occurrence_date,
            start_time=start_time,
            session_entry_id=entry.id,
        )
        self.db.add(completion)
        await self.db.flush()

        return CompleteScheduleSlotResponse(
            athlete_id=data.athlete_id,
            occurrence_date=data.occurrence_date,
            start_time=data.start_time,
            sessions_balance=link.sessions_balance,
            activity_name=activity_type.name_ru,
            effort=effort,
        )

    async def _get_coach_athlete_link(
        self,
        coach_profile: CoachProfile,
        athlete_id: UUID,
    ) -> CoachAthleteLink:
        result = await self.db.execute(
            select(CoachAthleteLink).where(
                CoachAthleteLink.coach_id == coach_profile.id,
                CoachAthleteLink.athlete_id == athlete_id,
            )
        )
        link = result.scalar_one_or_none()
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Атлет не найден")
        return link
