import { useCallback, useEffect, useState } from "react";
import { fetchAthleteUpcomingSessions, resolveMediaUrl } from "@sport-app/api-client";
import { formatAthleteUpcomingSession, type AthleteUpcomingSession } from "@sport-app/shared";
import { SessionsBalanceBadge, useLiveDataRefresh, usePullToRefresh } from "@sport-app/ui";

export function AthleteUpcomingSessionsPanel({ refreshKey }: { refreshKey?: string } = {}) {
  const [sessions, setSessions] = useState<AthleteUpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const items = await fetchAthleteUpcomingSessions(1);
      setSessions(items);
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

  const refreshSessions = useCallback(() => loadSessions({ silent: true }), [loadSessions]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, refreshKey]);

  useLiveDataRefresh(refreshSessions);
  usePullToRefresh(refreshSessions);

  const nextSession = sessions[0] ?? null;
  const avatarUrl = nextSession ? resolveMediaUrl(nextSession.coach_avatar_url) : null;
  const coachInitial = (nextSession?.coach_display_name?.slice(0, 1) ?? "?").toUpperCase();
  const whenLabel = nextSession ? formatAthleteUpcomingSession(nextSession) : "";

  return (
    <div className="athlete-home-section">
      <h2 className="athlete-home-section__title">Следующая тренировка</h2>

      {loading ? (
        <section className="athlete-home-sessions glass glass--panel">
          <p className="text-muted">Загрузка расписания…</p>
        </section>
      ) : error ? (
        <section className="athlete-home-sessions glass glass--panel">
          <p className="auth-error">{error}</p>
        </section>
      ) : nextSession == null ? (
        <section className="athlete-home-sessions glass glass--panel">
          <div className="athlete-empty-state">
            <span className="athlete-empty-state__icon" aria-hidden="true">
              📅
            </span>
            <p className="athlete-empty-state__text">
              Следующей тренировки нет. Тренер назначит её в расписании.
            </p>
          </div>
        </section>
      ) : (
        <section className="athlete-home-sessions glass glass--panel">
          <div className="athlete-home-sessions__item">
            <div className="athlete-home-sessions__when">{whenLabel}</div>
            {nextSession.activity_name ? (
              <div className="athlete-home-sessions__activity text-secondary">
                {nextSession.activity_name}
              </div>
            ) : null}
            <div className="athlete-home-sessions__coach">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="athlete-home-sessions__avatar" />
              ) : (
                <div
                  className="athlete-home-sessions__avatar athlete-home-sessions__avatar--placeholder"
                  aria-hidden="true"
                >
                  {coachInitial}
                </div>
              )}
              <div className="athlete-home-sessions__coach-meta">
                <span className="athlete-home-sessions__coach-name">
                  Тренер: {nextSession.coach_display_name}
                </span>
                <SessionsBalanceBadge balance={nextSession.sessions_balance} />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
