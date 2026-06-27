import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchAthleteUpcomingSessions, resolveMediaUrl } from "@sport-app/api-client";
import {
  formatAthleteUpcomingSessionDay,
  type AthleteUpcomingSession,
} from "@sport-app/shared";
import { SessionsBalanceBadge, useLiveDataRefresh, usePullToRefresh } from "@sport-app/ui";

function sessionKey(session: AthleteUpcomingSession): string {
  return `${session.coach_id}-${session.occurrence_date}-${session.start_time}`;
}

function UpcomingSessionItem({ session }: { session: AthleteUpcomingSession }) {
  const avatarUrl = resolveMediaUrl(session.coach_avatar_url);
  const coachInitial = (session.coach_display_name?.slice(0, 1) ?? "?").toUpperCase();

  return (
    <div className="athlete-home-sessions__item">
      <div className="athlete-home-sessions__time">{session.start_time}</div>
      {session.activity_name ? (
        <div className="athlete-home-sessions__activity text-secondary">{session.activity_name}</div>
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
        <span className="athlete-home-sessions__coach-name">Тренер: {session.coach_display_name}</span>
        <SessionsBalanceBadge balance={session.sessions_balance} />
      </div>
    </div>
  );
}

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
      const items = await fetchAthleteUpcomingSessions();
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

  const dayLabel = useMemo(
    () => (sessions[0] ? formatAthleteUpcomingSessionDay(sessions[0]) : ""),
    [sessions],
  );
  const sectionTitle = sessions.length > 1 ? "Следующие тренировки" : "Следующая тренировка";

  return (
    <div className="athlete-home-section">
      <h2
        className={`athlete-home-section__title${dayLabel ? " athlete-home-section__title--split" : ""}`}
      >
        <span>{sectionTitle}</span>
        {dayLabel ? <span className="athlete-home-section__when">{dayLabel}</span> : null}
      </h2>

      {loading ? (
        <section className="athlete-home-sessions glass glass--panel">
          <p className="text-muted">Загрузка расписания…</p>
        </section>
      ) : error ? (
        <section className="athlete-home-sessions glass glass--panel">
          <p className="auth-error">{error}</p>
        </section>
      ) : sessions.length === 0 ? (
        <section
          className="athlete-home-sessions glass glass--panel athlete-home-enter"
          style={{ "--enter-delay": "160ms" } as CSSProperties}
        >
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
        <section
          className="athlete-home-sessions glass glass--panel athlete-home-enter"
          style={{ "--enter-delay": "160ms" } as CSSProperties}
        >
          {sessions.map((session) => (
            <UpcomingSessionItem key={sessionKey(session)} session={session} />
          ))}
        </section>
      )}
    </div>
  );
}
