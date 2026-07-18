import { Fragment, useCallback, useEffect, useState } from "react";
import { fetchAdminCustomWorkouts } from "@sport-app/api-client";
import type { CustomWorkout } from "@sport-app/shared";

export function CoachCustomWorkoutsPage() {
  const [items, setItems] = useState<CustomWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAdminCustomWorkouts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-secondary">Загрузка…</p>;
  }

  if (error) {
    return (
      <div className="admin-catalog">
        <p className="auth-error">{error}</p>
        <button type="button" className="btn btn-outline" onClick={() => void load()}>
          Повторить
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-secondary">Тренеры пока не создали составные тренировки.</p>;
  }

  return (
    <div className="admin-catalog">
      <p className="admin-catalog__table-meta text-secondary">
        Только просмотр. Редактирование — в кабинете тренера. Всего: {items.length}
      </p>
      <div className="admin-catalog__table-wrap">
        <table className="admin-catalog__table">
          <thead>
            <tr>
              <th>Тренер</th>
              <th>Название</th>
              <th>MET</th>
              <th>Минуты</th>
              <th>MET·мин</th>
              <th>Этапы</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const open = expandedId === item.id;
              return (
                <Fragment key={item.id}>
                  <tr>
                    <td>{item.coach_name ?? "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: "0.25rem 0.5rem" }}
                        onClick={() => setExpandedId(open ? null : item.id)}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td>{item.average_met}</td>
                    <td>{item.total_duration_min}</td>
                    <td>{item.total_load_met_minutes}</td>
                    <td>{item.intervals.length}</td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={6}>
                        <ol style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
                          {item.intervals.map((interval) => (
                            <li key={interval.id}>
                              {interval.source_activity_name} · {interval.duration_min} мин · MET{" "}
                              {interval.source_met_value} · {interval.load_met_minutes} MET·мин
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
