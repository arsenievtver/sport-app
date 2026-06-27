import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAthleteWorkoutWeeklyDynamics } from "@sport-app/api-client";
import type { AthleteWorkoutWeeklyDynamics } from "@sport-app/shared";
import { WorkoutWeeklyChart } from "@sport-app/ui";

export function AthleteWorkoutDynamicsPanel() {
  const [data, setData] = useState<AthleteWorkoutWeeklyDynamics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAthleteWorkoutWeeklyDynamics();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить динамику тренировок");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentWeekCount = useMemo(() => {
    if (!data?.entries.length) return null;
    return data.entries[data.entries.length - 1]?.workouts_count ?? null;
  }, [data]);

  return (
    <section className="workout-dynamics">
      <div className="workout-dynamics__header">
        <h2 className="workout-dynamics__title">Динамика тренировок</h2>
        {currentWeekCount != null ? (
          <p className="workout-dynamics__current">
            На этой неделе <strong>{currentWeekCount}</strong>
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-muted">Загрузка…</p> : null}
      {!loading && data ? <WorkoutWeeklyChart entries={data.entries} /> : null}
      {error ? <p className="auth-error workout-dynamics__error">{error}</p> : null}
    </section>
  );
}
