import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAthleteCoaches, resolveMediaUrl } from "@sport-app/api-client";
import { SessionsBalanceBadge, usePullToRefresh } from "@sport-app/ui";
import type { AthleteCoachLink } from "@sport-app/shared";

function headingByCount(count: number): string {
  return count === 1 ? "Мой тренер" : "Мои тренеры";
}

export function AthleteCoachesHomePanel({ refreshKey }: { refreshKey?: string } = {}) {
  const [coaches, setCoaches] = useState<AthleteCoachLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCoaches = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const items = await fetchAthleteCoaches();
      setCoaches(items);
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

  const refreshCoaches = useCallback(() => loadCoaches({ silent: true }), [loadCoaches]);

  useEffect(() => {
    void loadCoaches();
  }, [loadCoaches, refreshKey]);

  usePullToRefresh(refreshCoaches);

  const activeCoaches = useMemo(
    () => coaches.filter((coach) => coach.link_status === "active" || coach.link_status === "pending"),
    [coaches],
  );

  if (loading) {
    return (
      <section className="athlete-home-coaches glass glass--panel">
        <p className="text-muted">Загрузка тренеров…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="athlete-home-coaches glass glass--panel">
        <p className="auth-error">{error}</p>
      </section>
    );
  }

  return (
    <section className="athlete-home-coaches glass glass--panel">
      <div className="athlete-home-coaches__header">
        <h2 className="athlete-home-coaches__title">{headingByCount(activeCoaches.length)}</h2>
      </div>

      {activeCoaches.length === 0 ? (
        <p className="text-secondary">Пока нет подключённых тренеров. Добавь тренера в настройках по коду.</p>
      ) : (
        <ul className="athlete-home-coaches__list">
          {activeCoaches.map((coach) => {
            const avatarUrl = resolveMediaUrl(coach.avatar_url);
            const initial = (coach.display_name?.slice(0, 1) ?? "?").toUpperCase();

            return (
              <li key={coach.link_id} className="athlete-home-coaches__item">
                <div className="athlete-home-coaches__identity">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="athlete-home-coaches__avatar" />
                  ) : (
                    <div className="athlete-home-coaches__avatar athlete-home-coaches__avatar--placeholder" aria-hidden="true">
                      {initial}
                    </div>
                  )}
                  <div>
                    <div className="athlete-home-coaches__name">{coach.display_name}</div>
                    <div className="athlete-home-coaches__status text-muted">
                      {coach.link_status === "pending" ? "Ожидает подтверждения" : "Активен"}
                    </div>
                  </div>
                </div>
                <SessionsBalanceBadge balance={coach.sessions_balance} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
