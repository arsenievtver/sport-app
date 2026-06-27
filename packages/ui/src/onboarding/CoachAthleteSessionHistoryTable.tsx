import { useEffect, useMemo, useState } from "react";
import { fetchCoachAthleteSessionHistory } from "@sport-app/api-client";
import type { CoachAthleteSessionHistoryEntry } from "@sport-app/shared";

interface SessionHistoryDayRow {
  entry_date: string;
  credited: number;
  debited: number;
}

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

function groupSessionHistoryByDate(entries: CoachAthleteSessionHistoryEntry[]): SessionHistoryDayRow[] {
  const byDate = new Map<string, SessionHistoryDayRow>();

  for (const entry of entries) {
    const current = byDate.get(entry.entry_date) ?? {
      entry_date: entry.entry_date,
      credited: 0,
      debited: 0,
    };

    if (entry.kind === "credit") {
      current.credited += entry.sessions_count;
    } else {
      current.debited += entry.sessions_count;
    }

    byDate.set(entry.entry_date, current);
  }

  return [...byDate.values()].sort((left, right) => right.entry_date.localeCompare(left.entry_date));
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

function formatCount(value: number): string {
  return value > 0 ? String(value) : "—";
}

interface CoachAthleteSessionHistoryTableProps {
  athleteId: string;
  balance: number;
}

export function CoachAthleteSessionHistoryTable({ athleteId, balance }: CoachAthleteSessionHistoryTableProps) {
  const [visibleMonth, setVisibleMonth] = useState<MonthRef>(() => getCurrentMonth());
  const [entries, setEntries] = useState<CoachAthleteSessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMonth = useMemo(() => getCurrentMonth(), []);
  const isCurrentMonth = isSameMonth(visibleMonth, currentMonth);
  const monthLabel = formatMonthLabel(visibleMonth);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

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

  const rows = useMemo(() => groupSessionHistoryByDate(entries), [entries]);

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
          disabled={loading}
          onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
        >
          ←
        </button>
        <div className="schedule-week-nav__label coach-athlete-history__month-label">{monthLabel}</div>
        <button
          type="button"
          className="schedule-week-nav__btn"
          aria-label="Следующий месяц"
          disabled={loading || isCurrentMonth}
          onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
        >
          →
        </button>
      </div>

      {loading ? <p className="coach-athlete-history__hint text-muted">Загрузка истории…</p> : null}
      {error ? <p className="auth-error coach-athlete-history__hint">{error}</p> : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="coach-athlete-history__hint text-secondary">За этот месяц операций нет.</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entry_date}>
                  <td className="coach-athlete-history__date">{formatHistoryDate(row.entry_date)}</td>
                  <td className="coach-athlete-history__credit">{formatCount(row.credited)}</td>
                  <td className="coach-athlete-history__debit">{formatCount(row.debited)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
