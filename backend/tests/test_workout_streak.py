from datetime import date, timedelta

from app.services.workout_streak import (
    compute_best_streak_weeks,
    compute_current_streak_weeks,
    medal_stack_count,
    next_medal_threshold,
)


def _monday() -> date:
    today = date(2026, 8, 15)  # Saturday
    return today - timedelta(days=today.weekday())


class TestComputeCurrentStreak:
    def test_counts_met_weeks_including_current(self):
        current = _monday()
        weeks = [
            (current - timedelta(weeks=3), 0),
            (current - timedelta(weeks=2), 2),
            (current - timedelta(weeks=1), 2),
            (current, 2),
        ]
        assert compute_current_streak_weeks(weeks, target=2, current_week_start=current) == 3

    def test_skips_unfinished_current_week(self):
        current = _monday()
        weeks = [
            (current - timedelta(weeks=2), 2),
            (current - timedelta(weeks=1), 2),
            (current, 1),
        ]
        assert compute_current_streak_weeks(weeks, target=2, current_week_start=current) == 2

    def test_break_resets_current(self):
        current = _monday()
        weeks = [
            (current - timedelta(weeks=3), 2),
            (current - timedelta(weeks=2), 0),
            (current - timedelta(weeks=1), 2),
            (current, 2),
        ]
        assert compute_current_streak_weeks(weeks, target=2, current_week_start=current) == 2


class TestComputeBestStreak:
    def test_best_survives_break(self):
        current = _monday()
        weeks = [
            (current - timedelta(weeks=5), 2),
            (current - timedelta(weeks=4), 2),
            (current - timedelta(weeks=3), 2),
            (current - timedelta(weeks=2), 0),
            (current - timedelta(weeks=1), 2),
            (current, 1),
        ]
        assert compute_best_streak_weeks(weeks, target=2, current_week_start=current) == 3
        assert compute_current_streak_weeks(weeks, target=2, current_week_start=current) == 1


class TestMedalHelpers:
    def test_thresholds_and_stacks(self):
        assert next_medal_threshold(0) == 4
        assert next_medal_threshold(4) == 12
        assert next_medal_threshold(52) == 56
        assert medal_stack_count(15 * 4, 4) == 15
        assert medal_stack_count(65, 52) == 1
        assert medal_stack_count(104, 52) == 2
        assert medal_stack_count(3, 4) == 0
