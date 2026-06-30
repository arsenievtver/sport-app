import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteCoachAthleteSessionEntry,
  fetchCoachAthleteActiveCreditBatches,
  fetchCoachAthleteSessionHistory,
} from "@sport-app/api-client";
import type {
  CoachAthleteActiveCreditBatch,
  CoachAthleteSessionHistoryEntry,
  CoachAthleteSessionsResponse,
} from "@sport-app/shared";

import { ICON_VIEW_BOX, iconStrokeProps } from "../icons/iconProps";

interface MonthRef {
  year: number;
  month: number;
}

function getCurrentMonth(): MonthRef {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const next = new Date(year, month - 1 + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

function isSameMonth(left: MonthRef, right: MonthRef): boolean {
  return left.year === right.year && left.month === right.month;
}

function formatMonthLabel({ year, month }: MonthRef): string {
  return new Date(year, month - 1, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function formatHistoryDate(value: string): string {
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return value;
  }
}

function formatBatchDate(value: string): string {
  try {
    const date = new Date(`${value}T12:00:00`);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}`;
  } catch {
    return value;
  }
}

function formatCount(value: number): string {
  return value > 0 ? String(value) : "—";
}

function projectedBalanceAfterDelete(
  balance: number,
  entry: CoachAthleteSessionHistoryEntry,
): number {
  return entry.kind === "credit"
    ? balance - entry.sessions_count
    : balance + entry.sessions_count;
}

function buildDeleteConfirmMessage(
  entry: CoachAthleteSessionHistoryEntry,
  balance: number,
): string {
  const sign = entry.kind === "credit" ? "+" : "−";
  const label = entry.kind === "credit" ? "начисление" : "списание";
  const nextBalance = projectedBalanceAfterDelete(balance, entry);
  return `Отменить ${label} ${sign}${entry.sessions_count}? Баланс станет: ${nextBalance}`;
}

function deleteEntryAriaLabel(entry: CoachAthleteSessionHistoryEntry): string {
  const sign = entry.kind === "credit" ? "+" : "−";
  const label = entry.kind === "credit" ? "начисление" : "списание";
  return `Удалить ${label} ${sign}${entry.sessions_count}`;
}

function TrashIcon() {
  return (
    <svg
      className="coach-athlete-history__delete-icon"
      viewBox={ICON_VIEW_BOX}
      aria-hidden="true"
    >
      <path d="M3 6h18" {...iconStrokeProps} />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" {...iconStrokeProps} />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" {...iconStrokeProps} />
    </svg>
  );
}

interface CoachAthleteSessionHistoryTableProps {
  athleteId: string;
  balance: number;
  onSessionsUpdated?: (result: CoachAthleteSessionsResponse) => void;
}

export function CoachAthleteSessionHistoryTable({
  athleteId,
  balance,
  onSessionsUpdated,
}: CoachAthleteSessionHistoryTableProps) {
  const [visibleMonth, setVisibleMonth] = useState<MonthRef>(() => getCurrentMonth());
  const [entries, setEntries] = useState<CoachAthleteSessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeBatches, setActiveBatches] = useState<CoachAthleteActiveCreditBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);

  const currentMonth = useMemo(() => getCurrentMonth(), []);
  const isCurrentMonth = isSameMonth(visibleMonth, currentMonth);
  const monthLabel = formatMonthLabel(visibleMonth);

  const loadActiveBatches = useCallback(() => {
    setBatchesLoading(true);
    return fetchCoachAthleteActiveCreditBatches(athleteId)
      .then(setActiveBatches)
      .catch(() => setActiveBatches([]))
      .finally(() => setBatchesLoading(false));
  }, [athleteId]);

  useEffect(() => {
    void loadActiveBatches();
  }, [loadActiveBatches, balance]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActionError(null);

    void fetchCoachAthleteSessionHistory(athleteId, visibleMonth.year, visibleMonth.month)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [athleteId, visibleMonth]);

  const handleDelete = async (entry: CoachAthleteSessionHistoryEntry) => {
    if (!window.confirm(buildDeleteConfirmMessage(entry, balance))) return;

    setDeletingId(entry.id);
    setActionError(null);
    try {
      const result = await deleteCoachAthleteSessionEntry({
        athlete_id: athleteId,
        entry_id: entry.id,
      });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      onSessionsUpdated?.(result);
      await loadActiveBatches();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отменить запись");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      className="coach-athlete-history glass glass--panel"
      aria-labelledby={`coach-athlete-history-${athleteId}`}
    >
      <header className="coach-athlete-history__header">
        <h4 id={`coach-athlete-history-${athleteId}`} className="coach-athlete-history__title">
          Начисления и списания
        </h4>
        <span className="coach-athlete-history__balance">
          Баланс: <strong>{balance}</strong>
        </span>
      </header>

      <div className="coach-athlete-history__month-nav schedule-week-nav">
        <button
          type="button"
          className="schedule-week-nav__btn"
          aria-label="Предыдущий месяц"
          disabled={loading || deletingId !== null}
          onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
        >
          ←
        </button>
        <div className="schedule-week-nav__label coach-athlete-history__month-label">{monthLabel}</div>
        <button
          type="button"
          className="schedule-week-nav__btn"
          aria-label="Следующий месяц"
          disabled={loading || deletingId !== null || isCurrentMonth}
          onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
        >
          →
        </button>
      </div>

      <div className="coach-athlete-history__batches">
        <div className="coach-athlete-history__batches-heading">
          <h5 className="coach-athlete-history__batches-title">Активные начисления</h5>
          <p className="coach-athlete-history__batches-hint text-secondary">
            Списания идут с самого раннего пакета. Полностью израсходованные скрываются.
          </p>
        </div>

        {batchesLoading ? (
          <p className="coach-athlete-history__hint text-muted">Считаем пакеты…</p>
        ) : activeBatches.length === 0 ? (
          <p className="coach-athlete-history__hint text-secondary">
            Сейчас нет неизрасходованных начислений на балансе.
          </p>
        ) : (
          <div className="coach-athlete-history__batches-table">
            <table className="coach-athlete-history__table coach-athlete-history__table--batches">
              <thead>
                <tr>
                  <th scope="col">Дата</th>
                  <th scope="col" aria-label="Начислено">
                    +
                  </th>
                  <th scope="col" aria-label="Проведено">
                    −
                  </th>
                  <th scope="col">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {activeBatches.map((batch) => (
                  <tr key={batch.entry_id}>
                    <td className="coach-athlete-history__batch-date">{formatBatchDate(batch.credited_date)}</td>
                    <td className="coach-athlete-history__credit">{batch.credited_count}</td>
                    <td className="coach-athlete-history__debit">{batch.completed_count}</td>
                    <td className="coach-athlete-history__remaining">{batch.remaining_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading ? <p className="coach-athlete-history__hint text-muted">Загрузка истории…</p> : null}
      {error ? <p className="auth-error coach-athlete-history__hint">{error}</p> : null}
      {actionError ? <p className="auth-error coach-athlete-history__hint">{actionError}</p> : null}

      {!loading && !error && entries.length === 0 ? (
        <p className="coach-athlete-history__hint text-secondary">За этот месяц операций нет.</p>
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <div className="coach-athlete-history__table-wrap">
          <table className="coach-athlete-history__table">
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col" aria-label="Начислено">
                  +
                </th>
                <th scope="col" aria-label="Списано">
                  −
                </th>
                <th scope="col" className="coach-athlete-history__actions-col" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                return (
                  <tr key={entry.id}>
                    <td className="coach-athlete-history__date">{formatHistoryDate(entry.entry_date)}</td>
                    <td className="coach-athlete-history__credit">
                      {entry.kind === "credit" ? formatCount(entry.sessions_count) : "—"}
                    </td>
                    <td className="coach-athlete-history__debit">
                      {entry.kind === "debit" ? formatCount(entry.sessions_count) : "—"}
                    </td>
                    <td className="coach-athlete-history__actions">
                      <button
                        type="button"
                        className="coach-athlete-history__delete-btn"
                        aria-label={deleteEntryAriaLabel(entry)}
                        title={deleteEntryAriaLabel(entry)}
                        disabled={deletingId !== null}
                        onClick={() => void handleDelete(entry)}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
