"""Weekly workout streak: consecutive weeks meeting plan_workouts_per_week."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class MedalTier:
    id: str
    weeks_required: int
    title: str


MEDAL_TIERS: tuple[MedalTier, ...] = (
    MedalTier(id="streak-1m", weeks_required=4, title="1 месяц"),
    MedalTier(id="streak-3m", weeks_required=12, title="3 месяца"),
    MedalTier(id="streak-6m", weeks_required=26, title="6 месяцев"),
    MedalTier(id="streak-12m", weeks_required=52, title="1 год"),
)

# How far back we look when computing streak / best.
STREAK_HISTORY_WEEKS = 156


def compute_current_streak_weeks(
    weeks_asc: list[tuple[date, int]],
    *,
    target: int,
    current_week_start: date,
) -> int:
    """Count consecutive plan-met weeks ending at/near the current week.

    Current week counts only if already met. If not met yet, it is skipped
    (week still in progress) and does not break the streak.
    """
    if target <= 0:
        return 0

    streak = 0
    for week_start, count in reversed(weeks_asc):
        met = count >= target
        if week_start == current_week_start:
            if met:
                streak += 1
            continue
        if met:
            streak += 1
        else:
            break
    return streak


def compute_best_streak_weeks(
    weeks_asc: list[tuple[date, int]],
    *,
    target: int,
    current_week_start: date,
) -> int:
    """Longest consecutive run of plan-met weeks.

    An unfinished current week (not yet met) does not reset a run that ends
    on the previous week — it simply ends the scan.
    """
    if target <= 0:
        return 0

    best = 0
    run = 0
    for week_start, count in weeks_asc:
        met = count >= target
        if met:
            run += 1
            best = max(best, run)
        elif week_start == current_week_start:
            break
        else:
            run = 0
    return best


def next_medal_threshold(current_streak_weeks: int) -> int:
    """Next week count the athlete is aiming for (medal unlock or next stack)."""
    for tier in MEDAL_TIERS:
        if current_streak_weeks < tier.weeks_required:
            return tier.weeks_required
    # All base medals earned on current streak — next 1-month stack.
    month = MEDAL_TIERS[0].weeks_required
    return ((current_streak_weeks // month) + 1) * month


def medal_stack_count(streak_weeks: int, weeks_required: int) -> int:
    if weeks_required <= 0 or streak_weeks < weeks_required:
        return 0
    return streak_weeks // weeks_required
