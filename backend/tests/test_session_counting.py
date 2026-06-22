from types import SimpleNamespace
from uuid import uuid4

from app.models.enums import CoachAthleteSessionEntryKind
from app.services.session_counting import (
    SELF_LOGGED_MIN_DURATION_MIN,
    SELF_LOGGED_MIN_EFFORT,
    SELF_LOGGED_MIN_MET,
    counts_toward_completed_sessions,
    self_logged_session_qualifies,
)


def _entry(
    *,
    link_id=None,
    duration_min: int | None = 60,
    effort: int | None = 5,
    sessions_count: int = 1,
    kind=CoachAthleteSessionEntryKind.debit,
    activity_met: float | None = 6.0,
):
    activity_type = (
        SimpleNamespace(met_value=activity_met) if activity_met is not None else None
    )
    return SimpleNamespace(
        link_id=link_id,
        duration_min=duration_min,
        sessions_count=sessions_count,
        effort=effort,
        kind=kind,
        activity_type=activity_type,
        activity_type_id=uuid4() if activity_type is not None else None,
    )


class TestSelfLoggedSessionQualifies:
    def test_with_coach_always_qualifies(self):
        entry = _entry(link_id=uuid4(), duration_min=10, effort=1, activity_met=2.0)
        assert self_logged_session_qualifies(entry) is True

    def test_self_logged_full_workout_qualifies(self):
        entry = _entry(link_id=None, duration_min=60, effort=5, activity_met=6.0)
        assert self_logged_session_qualifies(entry) is True

    def test_self_logged_short_session_does_not_qualify(self):
        entry = _entry(link_id=None, duration_min=59, effort=5, activity_met=6.0)
        assert self_logged_session_qualifies(entry) is False

    def test_self_logged_low_effort_does_not_qualify(self):
        entry = _entry(link_id=None, duration_min=60, effort=4, activity_met=6.0)
        assert self_logged_session_qualifies(entry) is False

    def test_self_logged_low_met_does_not_qualify(self):
        entry = _entry(link_id=None, duration_min=60, effort=5, activity_met=4.0)
        assert self_logged_session_qualifies(entry) is False

    def test_walking_met_is_excluded(self):
        entry = _entry(link_id=None, duration_min=90, effort=5, activity_met=3.5)
        assert self_logged_session_qualifies(entry) is False


class TestCountsTowardCompletedSessions:
    def test_credit_entries_never_count(self):
        entry = _entry(kind=CoachAthleteSessionEntryKind.credit, link_id=uuid4())
        assert counts_toward_completed_sessions(entry) is False

    def test_coach_debit_counts(self):
        entry = _entry(link_id=uuid4())
        assert counts_toward_completed_sessions(entry) is True

    def test_qualifying_self_logged_counts(self):
        entry = _entry(link_id=None, duration_min=60, effort=5, activity_met=6.0)
        assert counts_toward_completed_sessions(entry) is True

    def test_weak_self_logged_does_not_count(self):
        entry = _entry(link_id=None, duration_min=30, effort=5, activity_met=6.0)
        assert counts_toward_completed_sessions(entry) is False
