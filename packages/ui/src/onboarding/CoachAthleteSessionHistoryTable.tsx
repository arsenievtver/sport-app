import { useEffect, useMemo, useState } from "react";
import { fetchCoachAthleteSessionHistory } from "@sport-app/api-client";
import type { CoachAthleteSessionHistoryEntry } from "@sport-app/shared";

interface SessionHistoryDayRow {
  entry_date: string;
  credited: number;
  debited: number;
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
      month: "short",
      year: "numeric",
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
}

export function CoachAthleteSessionHistoryTable({ athleteId }: CoachAthleteSessionHistoryTableProps) {
  const [entries, setEntries] = useState<CoachAthleteSessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchCoachAthleteSessionHistory(athleteId)
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
  }, [athleteId]);

  const rows = useMemo(() => groupSessionHistoryByDate(entries), [entries]);

  return (
    <section className="coach-athlete-history" aria-labelledby={`coach-athlete-history-${athleteId}`}>
      <h4 id={`coach-athlete-history-${athleteId}`} className="coach-athlete-history__title">
        История начислений и списаний
      </h4>

      {loading ? <p className="coach-athlete-history__hint text-muted">Загрузка истории…</p> : null}
      {error ? <p className="auth-error coach-athlete-history__hint">{error}</p> : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="coach-athlete-history__hint text-secondary">
          Пока нет операций с балансом тренировок.
        </p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="coach-athlete-history__table-wrap">
          <table className="coach-athlete-history__table">
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">Начислено</th>
                <th scope="col">Списано</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entry_date}>
                  <td>{formatHistoryDate(row.entry_date)}</td>
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
