from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import CoachAthleteSessionEntryKind, PlanActivityTier
from app.models.session_ledger import CoachAthleteSessionEntry
from app.models.user import AthleteProfile, CoachAthleteLink
from app.schemas.athlete_plan import (
    AthletePlanResponse,
    AthletePlanUpdateRequest,
    AthleteWeekProgressMetric,
    AthleteWeekProgressResponse,
    AthleteWorkoutWeeklyDynamicsResponse,
    AthleteWorkoutWeeklyEntryResponse,
)
from app.services.activity_load import clamp_activity_effort
from app.services.activity_tier import get_tier_spec, resolve_activity_tier
from app.services.athlete_weight import AthleteWeightService
from app.services.baseline_calories import (
    calculate_daily_baseline_calories_kcal,
    calculate_target_daily_calories_kcal,
)
from app.services.session_counting import countable_session_entries


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


# Composite plan score: training frequency is the keystone habit (leading indicator);
# daily kcal and activity minutes are lagging outcomes of those sessions.
# 50 / 25 / 25 — same 2:1 ratio used in many adherence dashboards (primary KPI + two quality signals).
COMPLETION_WEIGHT_WORKOUTS = 0.50
COMPLETION_WEIGHT_CALORIES = 0.25
COMPLETION_WEIGHT_ACTIVITY = 0.25

WORKOUT_WEEKLY_CHART_WEEKS = 10

# Per-session reference for 100% resultative score (matches ACTIVITY_EFFORT_DEFAULT in shared).
RESULTATIVE_SESSION_FULL_DURATION_MIN = 60
RESULTATIVE_SESSION_TARGET_EFFORT = 5


def _completion_percent(workouts_pct: int, calories_pct: int, activity_pct: int) -> int:
    weighted = (
        workouts_pct * COMPLETION_WEIGHT_WORKOUTS
        + calories_pct * COMPLETION_WEIGHT_CALORIES
        + activity_pct * COMPLETION_WEIGHT_ACTIVITY
    )
    return round(weighted)


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

    async def get_weekly_workout_dynamics(
        self,
        profile: AthleteProfile,
        weeks: int = WORKOUT_WEEKLY_CHART_WEEKS,
    ) -> AthleteWorkoutWeeklyDynamicsResponse:
        weeks = max(1, min(weeks, 52))
        today = _athlete_today(profile)
        current_monday, _ = _week_bounds(today)
        oldest_monday = current_monday - timedelta(weeks=weeks - 1)

        result = await self.db.execute(
            select(CoachAthleteSessionEntry)
            .outerjoin(CoachAthleteLink, CoachAthleteSessionEntry.link_id == CoachAthleteLink.id)
            .where(
                CoachAthleteSessionEntry.kind == CoachAthleteSessionEntryKind.debit,
                CoachAthleteSessionEntry.entry_date >= oldest_monday,
                CoachAthleteSessionEntry.entry_date <= today,
                or_(
                    CoachAthleteLink.athlete_id == profile.id,
                    CoachAthleteSessionEntry.athlete_id == profile.id,
                ),
            )
            .options(selectinload(CoachAthleteSessionEntry.activity_type))
        )
        all_entries = list(result.scalars().all())
        countable = countable_session_entries(all_entries)

        counts_by_week: dict[date, int] = {}
        for entry in countable:
            week_start, _ = _week_bounds(entry.entry_date)
            counts_by_week[week_start] = counts_by_week.get(week_start, 0) + entry.sessions_count

        entries_out: list[AthleteWorkoutWeeklyEntryResponse] = []
        for index in range(weeks):
            week_start = oldest_monday + timedelta(weeks=index)
            entries_out.append(
                AthleteWorkoutWeeklyEntryResponse(
                    week_start=week_start,
                    workouts_count=counts_by_week.get(week_start, 0),
                )
            )

        return AthleteWorkoutWeeklyDynamicsResponse(entries=entries_out)

    async def get_week_progress(self, profile: AthleteProfile) -> AthleteWeekProgressResponse:
        today = _athlete_today(profile)
        week_start, week_end = _week_bounds(today)
        plan = await self.get_plan(profile)

        entries = await self._load_week_entries(profile.id, week_start, week_end)
        countable_entries = countable_session_entries(entries)

        workouts_completed = sum(entry.sessions_count for entry in countable_entries)
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
        workouts_pct = self._workouts_progress_percent(
            workouts_completed=workouts_completed,
            workouts_target=workouts_target,
            count_pct=count_pct,
            entries=countable_entries,
        )

        completion = _completion_percent(workouts_pct, calories_pct, activity_pct)

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
                label="Ккал в день",
                actual=round(daily_actual_kcal),
                target=round(daily_target_kcal),
                unit="ккал",
                percent=calories_pct,
            ),
            activity=AthleteWeekProgressMetric(
                label="Активность",
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
            .options(selectinload(CoachAthleteSessionEntry.activity_type))
        )
        return list(result.scalars().all())

    @staticmethod
    def _session_resultative_percent(duration_min: int | None, effort: int | None) -> int:
        """60 min + medium effort (5/10) = 100%; duration and effort contribute equally."""
        if duration_min is None or duration_min <= 0:
            return 0

        duration_score = min(
            100,
            round(duration_min / RESULTATIVE_SESSION_FULL_DURATION_MIN * 100),
        )
        effort_value = (
            RESULTATIVE_SESSION_TARGET_EFFORT
            if effort is None
            else clamp_activity_effort(effort)
        )
        effort_score = min(
            100,
            round(effort_value / RESULTATIVE_SESSION_TARGET_EFFORT * 100),
        )
        return round((duration_score + effort_score) / 2)

    @staticmethod
    def _sessions_resultative_percent(entries: list[CoachAthleteSessionEntry]) -> int:
        scores: list[int] = []
        for entry in entries:
            score = AthletePlanService._session_resultative_percent(entry.duration_min, entry.effort)
            scores.extend([score] * max(1, entry.sessions_count))
        if not scores:
            return 0
        return round(sum(scores) / len(scores))

    @staticmethod
    def _workouts_progress_percent(
        *,
        workouts_completed: int,
        workouts_target: int,
        count_pct: int,
        entries: list[CoachAthleteSessionEntry],
    ) -> int:
        if workouts_completed <= 0 or workouts_target <= 0:
            return 0

        session_quality_pct = AthletePlanService._sessions_resultative_percent(entries)

        if workouts_completed >= workouts_target:
            return min(count_pct, session_quality_pct)

        return round(count_pct * 0.5 + session_quality_pct * 0.5)
