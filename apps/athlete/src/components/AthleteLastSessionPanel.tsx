import { useCallback, useEffect, useState } from "react";
import { fetchAthleteLastSession } from "@sport-app/api-client";
import {
  formatAthleteLastSessionDate,
  formatCaloriesKcal,
  getActivityEffortLabel,
  type AthleteLastSession,
} from "@sport-app/shared";
import { useLiveDataRefresh, usePullToRefresh } from "@sport-app/ui";

interface AthleteLastSessionPanelProps {
  refreshKey?: string | number;
}

function formatWeightKg(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} кг`;
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}${suffix}`;
}

export function AthleteLastSessionPanel({ refreshKey }: AthleteLastSessionPanelProps = {}) {
  const [session, setSession] = useState<AthleteLastSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const item = await fetchAthleteLastSession();
      setSession(item);
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const refreshSession = useCallback(() => loadSession({ silent: true }), [loadSession]);

  useEffect(() => {
    void loadSession();
  }, [loadSession, refreshKey]);

  useLiveDataRefresh(refreshSession);
  usePullToRefresh(refreshSession);

  return (
    <div className="athlete-home-section">
      <h2 className="athlete-home-section__title">Последняя тренировка</h2>

      {loading ? (
        <section className="athlete-home-last-session glass glass--panel">
          <p className="text-muted">Загрузка…</p>
        </section>
      ) : error ? (
        <section className="athlete-home-last-session glass glass--panel">
          <p className="auth-error">{error}</p>
        </section>
      ) : session == null ? (
        <section className="athlete-home-last-session glass glass--panel">
          <div className="athlete-empty-state">
            <span className="athlete-empty-state__icon" aria-hidden="true">
              🏋️
            </span>
            <p className="athlete-empty-state__text">
              Пока нет завершённых тренировок. Отметь первую через кнопку «+».
            </p>
          </div>
        </section>
      ) : (
        <section className="athlete-home-last-session glass glass--panel">
          <div className="athlete-home-last-session__header">
            <div className="athlete-home-last-session__activity">
              {session.activity_name ?? "Тренировка"}
            </div>
            <div className="athlete-home-last-session__date text-muted">
              {formatAthleteLastSessionDate(session.entry_date)}
            </div>
          </div>

          <dl className="athlete-home-last-session__stats">
            {session.coach_display_name ? (
              <div className="athlete-home-last-session__stat">
                <dt className="text-muted">Тренер</dt>
                <dd>{session.coach_display_name}</dd>
              </div>
            ) : null}
            <div className="athlete-home-last-session__stat">
              <dt className="text-muted">Длительность</dt>
              <dd>{formatNumber(session.duration_min, " мин")}</dd>
            </div>
            <div className="athlete-home-last-session__stat">
              <dt className="text-muted">Усилие</dt>
              <dd>
                {session.effort != null
                  ? `${getActivityEffortLabel(session.effort)} (${session.effort}/10)`
                  : "—"}
              </dd>
            </div>
            <div className="athlete-home-last-session__stat">
              <dt className="text-muted">MET</dt>
              <dd>{formatNumber(session.effective_met)}</dd>
            </div>
            <div className="athlete-home-last-session__stat">
              <dt className="text-muted">Нагрузка</dt>
              <dd>{formatNumber(session.load_met_minutes, " MET·мин")}</dd>
            </div>
            <div className="athlete-home-last-session__stat">
              <dt className="text-muted">Вес</dt>
              <dd>{formatWeightKg(session.weight_kg_used)}</dd>
            </div>
            <div className="athlete-home-last-session__stat">
              <dt className="text-muted">Калории</dt>
              <dd>
                {session.calories_kcal != null
                  ? `~${formatCaloriesKcal(session.calories_kcal)} ккал`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
