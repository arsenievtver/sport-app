from dataclasses import dataclass
from datetime import date
from uuid import UUID

from app.models.enums import CoachAthleteSessionEntryKind
from app.models.session_ledger import CoachAthleteSessionEntry
from app.schemas.coach import CoachAthleteActiveCreditBatch


@dataclass
class _CreditLot:
    entry_id: UUID
    credited_date: date
    credited_count: int
    remaining: int
    completed_count: int


def compute_active_credit_batches(
    entries: list[CoachAthleteSessionEntry],
) -> list[CoachAthleteActiveCreditBatch]:
    """FIFO: debits consume the oldest credit lots first."""
    sorted_entries = sorted(
        entries,
        key=lambda entry: (entry.entry_date, entry.created_at),
    )
    lots: list[_CreditLot] = []

    for entry in sorted_entries:
        if entry.kind == CoachAthleteSessionEntryKind.credit:
            lots.append(
                _CreditLot(
                    entry_id=entry.id,
                    credited_date=entry.entry_date,
                    credited_count=entry.sessions_count,
                    remaining=entry.sessions_count,
                    completed_count=0,
                ),
            )
            continue

        to_consume = entry.sessions_count
        for lot in lots:
            if to_consume <= 0:
                break
            if lot.remaining <= 0:
                continue
            taken = min(lot.remaining, to_consume)
            lot.remaining -= taken
            lot.completed_count += taken
            to_consume -= taken

    return [
        CoachAthleteActiveCreditBatch(
            entry_id=lot.entry_id,
            credited_date=lot.credited_date,
            credited_count=lot.credited_count,
            completed_count=lot.completed_count,
            remaining_count=lot.remaining,
        )
        for lot in lots
        if lot.remaining > 0
    ]
