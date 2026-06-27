import { useCallback, useEffect, useState } from "react";
import { fetchAthleteSessionHistory } from "@sport-app/api-client";
import {
  formatAthleteLastSessionDate,
  formatCaloriesKcal,
  getActivityEffortLabel,
  SESSION_HISTORY_DAYS,
  type AthleteSessionHistoryItem,
} from "@sport-app/shared";
import { useLiveDataRefresh } from "../hooks/useLiveDataRefresh";
import "./athlete-plan.css";

interface AthleteWorkoutsPanelProps {
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

function WorkoutHistoryCard({ item }: { item: AthleteSessionHistoryItem }) {
  return (
    <li className="athlete-workouts__item glass glass--panel">
      <div className="athlete-workouts__item-header">
        <div className="athlete-workouts__item-title">{item.activity_name ?? "Активность"}</div>
        <div className="athlete-workouts__item-date text-muted">
          {formatAthleteLastSessionDate(item.entry_date)}
        </div>
      </div>

      <p className="athlete-workouts__item-summary text-secondary">
        {formatNumber(item.duration_min, " мин")}
        {item.effort != null ? ` · ${getActivityEffortLabel(item.effort)}` : ""}
        {item.calories_kcal != null ? ` · ~${formatCaloriesKcal(item.calories_kcal)} ккал` : ""}
      </p>

      <dl className="athlete-workouts__item-stats">
        {item.coach_display_name ? (
          <div className="athlete-workouts__stat">
            <dt className="text-muted">Тренер</dt>
            <dd>{item.coach_display_name}</dd>
          </div>
        ) : null}
        <div className="athlete-workouts__stat">
          <dt className="text-muted">MET</dt>
          <dd>{formatNumber(item.effective_met)}</dd>
        </div>
        <div className="athlete-workouts__stat">
          <dt className="text-muted">Нагрузка</dt>
          <dd>{formatNumber(item.load_met_minutes, " MET·мин")}</dd>
        </div>
        <div className="athlete-workouts__stat">
          <dt className="text-muted">Вес</dt>
          <dd>{formatWeightKg(item.weight_kg_used)}</dd>
        </div>
      </dl>
    </li>
  );
}

export function AthleteWorkoutsPanel({ refreshKey }: AthleteWorkoutsPanelProps) {
  const [items, setItems] = useState<AthleteSessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchAthleteSessionHistory();
      setItems(data);
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const refreshHistory = useCallback(() => loadHistory({ silent: true }), [loadHistory]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  useLiveDataRefresh(refreshHistory);

  return (
    <div className="athlete-overlay-screen">
      {loading ? (
        <p className="text-muted">Загрузка…</p>
      ) : error ? (
        <p className="auth-error">{error}</p>
      ) : items.length === 0 ? (
        <section className="athlete-workouts__empty glass glass--panel">
          <div className="athlete-empty-state">
            <span className="athlete-empty-state__icon" aria-hidden="true">
              🏋️
            </span>
            <p className="athlete-empty-state__text">
              За последние {SESSION_HISTORY_DAYS} дней активностей нет. Добавь первую через кнопку «+».
            </p>
          </div>
        </section>
      ) : (
        <ul className="athlete-workouts__list">
          {items.map((item) => (
            <WorkoutHistoryCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
