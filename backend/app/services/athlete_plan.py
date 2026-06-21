from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import CoachAthleteSessionEntryKind, PlanActivityTier
from app.models.session_ledger import CoachAthleteSessionEntry
from app.models.user import AthleteProfile, CoachAthleteLink
from app.schemas.athlete_plan import (
    AthletePlanResponse,
    AthletePlanUpdateRequest,
    AthleteWeekProgressMetric,
    AthleteWeekProgressResponse,
)
from app.services.activity_tier import get_tier_spec, resolve_activity_tier
from app.services.athlete_weight import AthleteWeightService
from app.services.baseline_calories import (
    calculate_daily_baseline_calories_kcal,
    calculate_target_daily_calories_kcal,
)


def _athlete_today(profile: AthleteProfile) -> date:
    tz_name = profile.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


def _week_bounds(reference: date) -> tuple[date, date]:
    monday = reference - timedelta(days=reference.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _progress_percent(actual: float, target: float) -> int:
    if target <= 0:
        return 100 if actual > 0 else 0
    return min(100, round(actual / target * 100))


class AthletePlanService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_baseline(self, profile: AthleteProfile) -> float | None:
        weight_kg = await AthleteWeightService(self.db).get_current_weight_kg(profile)
        if weight_kg is None:
            return profile.daily_baseline_calories_kcal

        baseline = calculate_daily_baseline_calories_kcal(profile, weight_kg, today=_athlete_today(profile))
        if profile.daily_baseline_calories_kcal != baseline:
            profile.daily_baseline_calories_kcal = baseline
            await self.db.flush()
        return baseline

    def _build_plan_targets(
        self,
        profile: AthleteProfile,
        weight_kg: float | None,
        sedentary_daily: float | None,
    ) -> tuple[PlanActivityTier, float | None, int, int]:
        tier = resolve_activity_tier(profile.plan_activity_tier)
        spec = get_tier_spec(tier)
        target_daily = None
        if weight_kg is not None:
            target_daily = calculate_target_daily_calories_kcal(
                profile,
                weight_kg,
                spec.pal,
                today=_athlete_today(profile),
            )
        daily_activity_min = round(spec.weekly_activity_min / 7)
        return tier, target_daily, spec.weekly_activity_min, daily_activity_min

    async def get_plan(self, profile: AthleteProfile) -> AthletePlanResponse:
        weight_kg = await AthleteWeightService(self.db).get_current_weight_kg(profile)
        sedentary_daily = await self.ensure_baseline(profile)
        tier, target_daily, weekly_activity_min, daily_activity_min = self._build_plan_targets(
            profile,
            weight_kg,
            sedentary_daily,
        )
        return AthletePlanResponse(
            workouts_per_week=profile.plan_workouts_per_week,
            activity_tier=tier,
            sedentary_daily_kcal=sedentary_daily,
            target_daily_kcal=target_daily,
            target_weekly_activity_min=weekly_activity_min,
            target_daily_activity_min=daily_activity_min,
            current_weight_kg=weight_kg,
        )

    async def update_plan(
        self,
        profile: AthleteProfile,
        data: AthletePlanUpdateRequest,
    ) -> AthletePlanResponse:
        if data.workouts_per_week is not None:
            profile.plan_workouts_per_week = data.workouts_per_week
        if data.activity_tier is not None:
            profile.plan_activity_tier = data.activity_tier
        await self.db.flush()
        return await self.get_plan(profile)

    async def get_week_progress(self, profile: AthleteProfile) -> AthleteWeekProgressResponse:
        today = _athlete_today(profile)
        week_start, week_end = _week_bounds(today)
        plan = await self.get_plan(profile)

        entries = await self._load_week_entries(profile.id, week_start, week_end)

        workouts_completed = sum(entry.sessions_count for entry in entries)
        workouts_target = plan.workouts_per_week

        sedentary_daily = plan.sedentary_daily_kcal or 0
        target_daily_kcal = plan.target_daily_kcal or sedentary_daily

        workout_kcal_total = sum(entry.calories_kcal or 0 for entry in entries)
        workout_min_total = sum(entry.duration_min or 0 for entry in entries)

        # Daily averages over the calendar week (Mon–Sun).
        daily_actual_kcal = sedentary_daily + workout_kcal_total / 7
        daily_target_kcal = target_daily_kcal
        daily_actual_activity_min = workout_min_total / 7
        daily_target_activity_min = plan.target_daily_activity_min

        calories_pct = _progress_percent(daily_actual_kcal, daily_target_kcal)
        activity_pct = _progress_percent(daily_actual_activity_min, daily_target_activity_min)

        count_pct = _progress_percent(workouts_completed, workouts_target)
        workouts_pct = self._workouts_quality_percent(
            workouts_completed=workouts_completed,
            workouts_target=workouts_target,
            count_pct=count_pct,
            workout_kcal_total=workout_kcal_total,
            workout_min_total=workout_min_total,
            target_daily_kcal=target_daily_kcal,
            sedentary_daily=sedentary_daily,
            target_weekly_activity_min=plan.target_weekly_activity_min,
        )

        completion = round((workouts_pct + calories_pct + activity_pct) / 3)

        return AthleteWeekProgressResponse(
            week_start=week_start.isoformat(),
            week_end=week_end.isoformat(),
            completion_percent=completion,
            workouts=AthleteWeekProgressMetric(
                label="Тренировки",
                actual=float(workouts_completed),
                target=float(workouts_target),
                unit="",
                percent=workouts_pct,
            ),
            calories=AthleteWeekProgressMetric(
                label="Калории в день",
                actual=round(daily_actual_kcal),
                target=round(daily_target_kcal),
                unit="ккал",
                percent=calories_pct,
            ),
            activity=AthleteWeekProgressMetric(
                label="Время активности",
                actual=round(daily_actual_activity_min),
                target=round(daily_target_activity_min),
                unit="мин/день",
                percent=activity_pct,
            ),
        )

    async def _load_week_entries(
        self,
        athlete_id,
        week_start: date,
        week_end: date,
    ) -> list[CoachAthleteSessionEntry]:
        result = await self.db.execute(
            select(CoachAthleteSessionEntry)
            .outerjoin(CoachAthleteLink, CoachAthleteSessionEntry.link_id == CoachAthleteLink.id)
            .where(
                CoachAthleteSessionEntry.kind == CoachAthleteSessionEntryKind.debit,
                CoachAthleteSessionEntry.entry_date >= week_start,
                CoachAthleteSessionEntry.entry_date <= week_end,
                or_(
                    CoachAthleteLink.athlete_id == athlete_id,
                    CoachAthleteSessionEntry.athlete_id == athlete_id,
                ),
            )
        )
        return list(result.scalars().all())

    @staticmethod
    def _workouts_quality_percent(
        *,
        workouts_completed: int,
        workouts_target: int,
        count_pct: int,
        workout_kcal_total: float,
        workout_min_total: int,
        target_daily_kcal: float,
        sedentary_daily: float,
        target_weekly_activity_min: int,
    ) -> int:
        """Count alone is not enough — weak sessions lower plan adherence."""
        if workouts_completed <= 0 or workouts_target <= 0:
            return 0

        weekly_active_kcal_target = max(0.0, (target_daily_kcal - sedentary_daily) * 7)
        expected_kcal_per_session = weekly_active_kcal_target / workouts_target
        expected_min_per_session = target_weekly_activity_min / workouts_target

        avg_kcal = workout_kcal_total / workouts_completed
        avg_min = workout_min_total / workouts_completed

        quality_parts: list[int] = []
        if expected_kcal_per_session > 0:
            quality_parts.append(_progress_percent(avg_kcal, expected_kcal_per_session))
        if expected_min_per_session > 0:
            quality_parts.append(_progress_percent(avg_min, expected_min_per_session))

        session_quality_pct = (
            round(sum(quality_parts) / len(quality_parts)) if quality_parts else count_pct
        )

        if workouts_completed >= workouts_target:
            return min(count_pct, session_quality_pct)

        # Partial week: blend progress toward count with session quality so far.
        return round(count_pct * 0.5 + session_quality_pct * 0.5)
