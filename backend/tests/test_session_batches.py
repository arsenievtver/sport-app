"""FIFO allocation of session debits across credit batches."""

from datetime import UTC, date, datetime
from uuid import uuid4

from app.models.enums import CoachAthleteSessionEntryKind
from app.models.session_ledger import CoachAthleteSessionEntry
from app.services.session_batches import compute_active_credit_batches


def _entry(
    *,
    kind: CoachAthleteSessionEntryKind,
    count: int,
    entry_date: date,
    created_at: datetime,
) -> CoachAthleteSessionEntry:
    return CoachAthleteSessionEntry(
        id=uuid4(),
        link_id=uuid4(),
        kind=kind,
        sessions_count=count,
        entry_date=entry_date,
        created_at=created_at,
    )


def test_single_active_batch_partially_used():
    d1 = date(2026, 1, 5)
    entries = [
        _entry(
            kind=CoachAthleteSessionEntryKind.credit,
            count=10,
            entry_date=d1,
            created_at=datetime(2026, 1, 5, 10, 0, tzinfo=UTC),
        ),
        *[
            _entry(
                kind=CoachAthleteSessionEntryKind.debit,
                count=1,
                entry_date=date(2026, 1, 10 + i),
                created_at=datetime(2026, 1, 10 + i, 12, 0, tzinfo=UTC),
            )
            for i in range(9)
        ],
    ]

    batches = compute_active_credit_batches(entries)

    assert len(batches) == 1
    assert batches[0].credited_date == d1
    assert batches[0].credited_count == 10
    assert batches[0].completed_count == 9
    assert batches[0].remaining_count == 1


def test_two_active_batches_when_first_not_fully_used():
    d1 = date(2026, 1, 5)
    d2 = date(2026, 1, 20)
    entries = [
        _entry(
            kind=CoachAthleteSessionEntryKind.credit,
            count=10,
            entry_date=d1,
            created_at=datetime(2026, 1, 5, 10, 0, tzinfo=UTC),
        ),
        *[
            _entry(
                kind=CoachAthleteSessionEntryKind.debit,
                count=1,
                entry_date=date(2026, 1, 6 + i),
                created_at=datetime(2026, 1, 6 + i, 12, 0, tzinfo=UTC),
            )
            for i in range(9)
        ],
        _entry(
            kind=CoachAthleteSessionEntryKind.credit,
            count=5,
            entry_date=d2,
            created_at=datetime(2026, 1, 20, 10, 0, tzinfo=UTC),
        ),
    ]

    batches = compute_active_credit_batches(entries)

    assert len(batches) == 2
    assert batches[0].credited_date == d1
    assert batches[0].completed_count == 9
    assert batches[0].remaining_count == 1
    assert batches[1].credited_date == d2
    assert batches[1].credited_count == 5
    assert batches[1].completed_count == 0
    assert batches[1].remaining_count == 5


def test_fully_consumed_batch_is_hidden():
    d1 = date(2026, 1, 5)
    entries = [
        _entry(
            kind=CoachAthleteSessionEntryKind.credit,
            count=10,
            entry_date=d1,
            created_at=datetime(2026, 1, 5, 10, 0, tzinfo=UTC),
        ),
        *[
            _entry(
                kind=CoachAthleteSessionEntryKind.debit,
                count=1,
                entry_date=date(2026, 1, 6 + i),
                created_at=datetime(2026, 1, 6 + i, 12, 0, tzinfo=UTC),
            )
            for i in range(10)
        ],
    ]

    assert compute_active_credit_batches(entries) == []


def test_second_batch_receives_debits_after_first_is_exhausted():
    d1 = date(2026, 1, 5)
    d2 = date(2026, 1, 20)
    entries = [
        _entry(
            kind=CoachAthleteSessionEntryKind.credit,
            count=10,
            entry_date=d1,
            created_at=datetime(2026, 1, 5, 10, 0, tzinfo=UTC),
        ),
        *[
            _entry(
                kind=CoachAthleteSessionEntryKind.debit,
                count=1,
                entry_date=date(2026, 1, 6 + i),
                created_at=datetime(2026, 1, 6 + i, 12, 0, tzinfo=UTC),
            )
            for i in range(10)
        ],
        _entry(
            kind=CoachAthleteSessionEntryKind.credit,
            count=5,
            entry_date=d2,
            created_at=datetime(2026, 1, 20, 9, 0, tzinfo=UTC),
        ),
        *[
            _entry(
                kind=CoachAthleteSessionEntryKind.debit,
                count=1,
                entry_date=date(2026, 1, 21 + i),
                created_at=datetime(2026, 1, 21 + i, 12, 0, tzinfo=UTC),
            )
            for i in range(2)
        ],
    ]

    batches = compute_active_credit_batches(entries)

    assert len(batches) == 1
    assert batches[0].credited_date == d2
    assert batches[0].completed_count == 2
    assert batches[0].remaining_count == 3
