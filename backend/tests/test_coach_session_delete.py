"""Coach session ledger delete logic."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.enums import CoachAthleteLinkStatus, CoachAthleteSessionEntryKind
from app.models.session_ledger import CoachAthleteSessionEntry
from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile
from app.services.coach import CoachService


def _link(*, balance: int = 10) -> CoachAthleteLink:
    coach = CoachProfile(id=uuid4(), user_id=uuid4())
    athlete = AthleteProfile(id=uuid4(), display_name="Test", managed_by_coach_id=coach.id)
    return CoachAthleteLink(
        id=uuid4(),
        coach_id=coach.id,
        athlete_id=athlete.id,
        status=CoachAthleteLinkStatus.active,
        started_at=datetime.now(UTC),
        sessions_balance=balance,
        athlete=athlete,
        session_entries=[],
    )


def _entry(link: CoachAthleteLink, *, kind: CoachAthleteSessionEntryKind, count: int) -> CoachAthleteSessionEntry:
    return CoachAthleteSessionEntry(
        id=uuid4(),
        link_id=link.id,
        kind=kind,
        sessions_count=count,
        entry_date=datetime.now(UTC).date(),
    )


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDb:
    def __init__(self, entry: CoachAthleteSessionEntry | None):
        self.entry = entry
        self.deleted: list[CoachAthleteSessionEntry] = []

    async def execute(self, _query):
        return _FakeResult(self.entry)

    async def delete(self, entry: CoachAthleteSessionEntry):
        self.deleted.append(entry)

    async def flush(self):
        return None


def _service_with_entry(link: CoachAthleteLink, entry: CoachAthleteSessionEntry | None) -> CoachService:
    service = CoachService(_FakeDb(entry))  # type: ignore[arg-type]

    async def fake_get_link(_coach_profile, _athlete_id):
        return link

    async def fake_count_completed(_link_id):
        return 0

    service._get_link = fake_get_link  # type: ignore[method-assign]
    service._count_completed_sessions = fake_count_completed  # type: ignore[method-assign]
    return service


@pytest.mark.asyncio
async def test_delete_credit_reverses_balance():
    link = _link(balance=10)
    entry = _entry(link, kind=CoachAthleteSessionEntryKind.credit, count=5)
    service = _service_with_entry(link, entry)

    result = await service.delete_session_entry(
        CoachProfile(id=link.coach_id, user_id=uuid4()),
        link.athlete_id,
        entry.id,
    )

    assert link.sessions_balance == 5
    assert result.sessions_balance == 5


@pytest.mark.asyncio
async def test_delete_debit_restores_balance():
    link = _link(balance=3)
    entry = _entry(link, kind=CoachAthleteSessionEntryKind.debit, count=1)
    service = _service_with_entry(link, entry)

    result = await service.delete_session_entry(
        CoachProfile(id=link.coach_id, user_id=uuid4()),
        link.athlete_id,
        entry.id,
    )

    assert link.sessions_balance == 4
    assert result.sessions_balance == 4


@pytest.mark.asyncio
async def test_delete_credit_blocked_when_balance_too_low():
    link = _link(balance=2)
    entry = _entry(link, kind=CoachAthleteSessionEntryKind.credit, count=5)
    service = _service_with_entry(link, entry)

    with pytest.raises(HTTPException) as exc:
        await service.delete_session_entry(
            CoachProfile(id=link.coach_id, user_id=uuid4()),
            link.athlete_id,
            entry.id,
        )

    assert exc.value.status_code == 400
    assert link.sessions_balance == 2
