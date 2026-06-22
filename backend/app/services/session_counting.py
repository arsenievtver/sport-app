"""Rules for which session debits count as completed workouts (badge, plan count)."""

from sqlalchemy import and_, or_

from app.models.activity_type import ActivityType
from app.models.enums import CoachAthleteSessionEntryKind
from app.models.session_ledger import CoachAthleteSessionEntry
from app.services.activity_load import clamp_activity_effort

# Self-logged workouts (without coach) must meet plan-style quality + base MET floor.
SELF_LOGGED_MIN_DURATION_MIN = 60
SELF_LOGGED_MIN_EFFORT = 5
SELF_LOGGED_MIN_MET = 4.0


def self_logged_session_qualifies(
    entry: CoachAthleteSessionEntry,
    *,
    activity_met: float | None = None,
) -> bool:
    if entry.link_id is not None:
        return True

    duration_min = entry.duration_min
    if duration_min is None or duration_min < SELF_LOGGED_MIN_DURATION_MIN:
        return False

    effort = entry.effort
    if effort is None or clamp_activity_effort(effort) < SELF_LOGGED_MIN_EFFORT:
        return False

    met = activity_met
    if met is None and entry.activity_type is not None:
        met = entry.activity_type.met_value
    if met is None or met <= SELF_LOGGED_MIN_MET:
        return False

    return True


def counts_toward_completed_sessions(entry: CoachAthleteSessionEntry) -> bool:
    if entry.kind != CoachAthleteSessionEntryKind.debit:
        return False
    return self_logged_session_qualifies(entry)


def countable_session_entries(
    entries: list[CoachAthleteSessionEntry],
) -> list[CoachAthleteSessionEntry]:
    return [entry for entry in entries if counts_toward_completed_sessions(entry)]


def completed_sessions_count_sql_filter():
    """SQL filter: debit entries that count toward the athlete workout badge."""
    self_logged_ok = and_(
        CoachAthleteSessionEntry.link_id.is_(None),
        CoachAthleteSessionEntry.duration_min.is_not(None),
        CoachAthleteSessionEntry.duration_min >= SELF_LOGGED_MIN_DURATION_MIN,
        CoachAthleteSessionEntry.effort.is_not(None),
        CoachAthleteSessionEntry.effort >= SELF_LOGGED_MIN_EFFORT,
        ActivityType.met_value > SELF_LOGGED_MIN_MET,
    )
    return and_(
        CoachAthleteSessionEntry.kind == CoachAthleteSessionEntryKind.debit,
        or_(
            CoachAthleteSessionEntry.link_id.is_not(None),
            self_logged_ok,
        ),
    )
