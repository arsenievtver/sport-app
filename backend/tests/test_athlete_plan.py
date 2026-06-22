from types import SimpleNamespace

from app.services.athlete_plan import (
    RESULTATIVE_SESSION_FULL_DURATION_MIN,
    RESULTATIVE_SESSION_TARGET_EFFORT,
    AthletePlanService,
)


def _entry(*, duration_min: int | None, effort: int | None = 5, sessions_count: int = 1):
    return SimpleNamespace(duration_min=duration_min, sessions_count=sessions_count, effort=effort)


class TestSessionResultativePercent:
    def test_sixty_minutes_and_medium_effort_is_full(self):
        assert (
            AthletePlanService._session_resultative_percent(
                RESULTATIVE_SESSION_FULL_DURATION_MIN,
                RESULTATIVE_SESSION_TARGET_EFFORT,
            )
            == 100
        )

    def test_longer_session_stays_capped_at_full(self):
        assert AthletePlanService._session_resultative_percent(90, 7) == 100

    def test_half_duration_with_medium_effort(self):
        assert AthletePlanService._session_resultative_percent(30, 5) == 75

    def test_full_duration_with_lower_effort(self):
        assert AthletePlanService._session_resultative_percent(60, 3) == 80

    def test_missing_duration_is_zero(self):
        assert AthletePlanService._session_resultative_percent(None, 5) == 0

    def test_missing_effort_defaults_to_medium(self):
        assert AthletePlanService._session_resultative_percent(60, None) == 100


class TestWorkoutsProgressPercent:
    def test_two_planned_sessions_at_reference_close_plan_fully(self):
        entries = [_entry(duration_min=60, effort=5), _entry(duration_min=60, effort=5)]
        result = AthletePlanService._workouts_progress_percent(
            workouts_completed=2,
            workouts_target=2,
            count_pct=100,
            entries=entries,
        )
        assert result == 100

    def test_extra_sessions_still_reach_full_when_each_is_resultative(self):
        entries = [_entry(duration_min=60, effort=5) for _ in range(10)]
        result = AthletePlanService._workouts_progress_percent(
            workouts_completed=10,
            workouts_target=2,
            count_pct=100,
            entries=entries,
        )
        assert result == 100

    def test_plan_met_but_weak_sessions_lower_score(self):
        entries = [_entry(duration_min=10, effort=5), _entry(duration_min=10, effort=5)]
        result = AthletePlanService._workouts_progress_percent(
            workouts_completed=2,
            workouts_target=2,
            count_pct=100,
            entries=entries,
        )
        assert result == 59

    def test_partial_week_blends_count_and_quality(self):
        entries = [_entry(duration_min=60, effort=5)]
        result = AthletePlanService._workouts_progress_percent(
            workouts_completed=1,
            workouts_target=2,
            count_pct=50,
            entries=entries,
        )
        assert result == 75
