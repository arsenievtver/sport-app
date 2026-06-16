import { useEffect, useMemo, useState } from "react";
import { fetchAthleteCoaches } from "@sport-app/api-client";
import type { AthleteCoachLink } from "@sport-app/shared";

function headingByCount(count: number): string {
  return count === 1 ? "Мой тренер" : "Мои тренеры";
}

export function AthleteCoachesHomePanel() {
  const [coaches, setCoaches] = useState<AthleteCoachLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAthleteCoaches()
      .then((items) => {
        if (!cancelled) setCoaches(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        <span className="badge badge-primary">{activeCoaches.length}</span>
      </div>

      {activeCoaches.length === 0 ? (
        <p className="text-secondary">Пока нет подключённых тренеров. Добавь тренера в настройках по коду.</p>
      ) : (
        <ul className="athlete-home-coaches__list">
          {activeCoaches.map((coach) => (
            <li key={coach.link_id} className="athlete-home-coaches__item">
              <div>
                <div className="athlete-home-coaches__name">{coach.display_name}</div>
                <div className="athlete-home-coaches__status text-muted">
                  {coach.link_status === "pending" ? "Ожидает подтверждения" : "Активен"}
                </div>
              </div>
              <span className="badge badge-accent">Тренировок: {coach.sessions_balance}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
