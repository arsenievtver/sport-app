import { useCallback, useEffect, useState } from "react";
import { fetchAthleteUpcomingSessions, resolveMediaUrl } from "@sport-app/api-client";
import { formatAthleteUpcomingSession, type AthleteUpcomingSession } from "@sport-app/shared";
import { useLiveDataRefresh, usePullToRefresh } from "@sport-app/ui";

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
      const items = await fetchAthleteUpcomingSessions(4);
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

  if (loading) {
    return (
      <section className="athlete-home-sessions glass glass--panel">
        <p className="text-muted">Загрузка расписания…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="athlete-home-sessions glass glass--panel">
        <p className="auth-error">{error}</p>
      </section>
    );
  }

  return (
    <section className="athlete-home-sessions glass glass--panel">
      <div className="athlete-home-sessions__header">
        <h2 className="athlete-home-sessions__title">Ближайшие тренировки</h2>
      </div>

      {sessions.length === 0 ? (
        <p className="text-secondary">Пока нет запланированных тренировок. Тренер назначит их в расписании.</p>
      ) : (
        <ul className="athlete-home-sessions__list">
          {sessions.map((session) => {
            const avatarUrl = resolveMediaUrl(session.coach_avatar_url);
            const initial = (session.coach_display_name?.slice(0, 1) ?? "?").toUpperCase();
            const whenLabel = formatAthleteUpcomingSession(session);

            return (
              <li
                key={`${session.coach_id}-${session.occurrence_date}-${session.start_time}`}
                className="athlete-home-sessions__item"
              >
                <div className="athlete-home-sessions__when">{whenLabel}</div>
                <div className="athlete-home-sessions__coach">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="athlete-home-sessions__avatar" />
                  ) : (
                    <div
                      className="athlete-home-sessions__avatar athlete-home-sessions__avatar--placeholder"
                      aria-hidden="true"
                    >
                      {initial}
                    </div>
                  )}
                  <span className="athlete-home-sessions__coach-name">
                    Тренер: {session.coach_display_name}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
