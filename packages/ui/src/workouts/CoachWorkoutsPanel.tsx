import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCoachCustomWorkout,
  deleteCoachCustomWorkout,
  fetchCoachActivityTypes,
  fetchCoachCustomWorkouts,
  updateCoachCustomWorkout,
} from "@sport-app/api-client";
import {
  ACTIVITY_DURATION_MIN_MAX,
  ACTIVITY_DURATION_MIN_MIN,
  calculateCustomWorkoutSummary,
  type ActivityType,
  type CustomWorkout,
} from "@sport-app/shared";
import { ActivityTypePicker } from "../activity/ActivityTypePicker";
import { WheelNumberPicker } from "../wheel/WheelNumberPicker";

interface IntervalDraft {
  key: string;
  source_activity_type_id: string;
  duration_min: number;
  label: string;
}

function newIntervalKey(): string {
  return `i-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyInterval(defaultActivityId = ""): IntervalDraft {
  return {
    key: newIntervalKey(),
    source_activity_type_id: defaultActivityId,
    duration_min: 10,
    label: "",
  };
}

function workoutToDrafts(workout: CustomWorkout): IntervalDraft[] {
  return workout.intervals.map((item) => ({
    key: item.id,
    source_activity_type_id: item.source_activity_type_id,
    duration_min: item.duration_min,
    label: item.label ?? "",
  }));
}

export function CoachWorkoutsPanel({ onBack }: { onBack?: () => void } = {}) {
  const [workouts, setWorkouts] = useState<CustomWorkout[]>([]);
  const [compendium, setCompendium] = useState<ActivityType[]>([]);
  const [headingLabels, setHeadingLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [intervals, setIntervals] = useState<IntervalDraft[]>([emptyInterval()]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activityById = useMemo(() => {
    const map = new Map<string, ActivityType>();
    for (const item of compendium) {
      map.set(item.id, item);
    }
    return map;
  }, [compendium]);

  const summary = useMemo(() => {
    const resolved = intervals
      .filter((item) => item.source_activity_type_id)
      .map((item) => ({
        met_value: activityById.get(item.source_activity_type_id)?.met_value ?? 0,
        duration_min: item.duration_min,
      }));
    return calculateCustomWorkoutSummary(resolved);
  }, [intervals, activityById]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workoutList, activityList] = await Promise.all([
        fetchCoachCustomWorkouts(),
        fetchCoachActivityTypes(),
      ]);
      setWorkouts(workoutList);
      setCompendium(activityList.items.filter((item) => item.owner_coach_id == null));
      setHeadingLabels(activityList.major_heading_labels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить тренировки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    const defaultId = compendium[0]?.id ?? "";
    setEditingId(null);
    setName("");
    setIntervals([emptyInterval(defaultId)]);
    setError(null);
    setMode("edit");
  };

  const openEdit = (workout: CustomWorkout) => {
    setEditingId(workout.id);
    setName(workout.name);
    setIntervals(workoutToDrafts(workout));
    setError(null);
    setMode("edit");
  };

  const backToList = () => {
    setMode("list");
    setEditingId(null);
    setError(null);
  };

  const updateInterval = (key: string, patch: Partial<IntervalDraft>) => {
    setIntervals((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const moveInterval = (key: string, direction: -1 | 1) => {
    setIntervals((current) => {
      const index = current.findIndex((item) => item.key === key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return copy;
    });
  };

  const removeInterval = (key: string) => {
    setIntervals((current) => (current.length <= 1 ? current : current.filter((item) => item.key !== key)));
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Укажите название тренировки");
      return;
    }
    if (intervals.some((item) => !item.source_activity_type_id)) {
      setError("Выберите активность для каждого этапа");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: trimmed,
      intervals: intervals.map((item) => ({
        source_activity_type_id: item.source_activity_type_id,
        duration_min: item.duration_min,
        label: item.label.trim() || null,
      })),
    };
    try {
      if (editingId) {
        await updateCoachCustomWorkout(editingId, payload);
      } else {
        await createCoachCustomWorkout(payload);
      }
      await load();
      backToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!window.confirm("Удалить эту тренировку?")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCoachCustomWorkout(editingId);
      await load();
      backToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  };

  if (loading && mode === "list") {
    return <p className="text-muted">Загрузка…</p>;
  }

  if (mode === "edit") {
    return (
      <div className="coach-workouts">
        <button type="button" className="coach-workouts__back text-secondary" onClick={backToList}>
          ← К списку
        </button>

        <div className="coach-workouts__summary glass glass--panel">
          <div className="coach-workouts__summary-met">
            <span className="coach-workouts__summary-value">{summary.average_met || "—"}</span>
            <span className="coach-workouts__summary-unit text-muted">средний MET</span>
          </div>
          <div className="coach-workouts__summary-meta text-secondary">
            <span>{summary.total_duration_min} мин</span>
            <span aria-hidden="true">·</span>
            <span>{summary.total_load_met_minutes} MET·мин</span>
            <span aria-hidden="true">·</span>
            <span>{intervals.length} этап{intervals.length === 1 ? "" : intervals.length < 5 ? "а" : "ов"}</span>
          </div>
        </div>

        <label className="coach-workouts__field">
          <span className="text-secondary">Название</span>
          <input
            className="glass-input"
            value={name}
            maxLength={200}
            placeholder="Например: Бокс + силовая"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <div className="coach-workouts__intervals">
          {intervals.map((item, index) => {
            const source = activityById.get(item.source_activity_type_id);
            const load = source ? Math.round(source.met_value * item.duration_min * 10) / 10 : 0;
            return (
              <div key={item.key} className="coach-workouts__interval glass glass--panel">
                <div className="coach-workouts__interval-head">
                  <span className="coach-workouts__interval-index text-muted">Этап {index + 1}</span>
                  <div className="coach-workouts__interval-actions">
                    <button
                      type="button"
                      className="coach-btn coach-btn--muted"
                      disabled={index === 0}
                      aria-label="Выше"
                      onClick={() => moveInterval(item.key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="coach-btn coach-btn--muted"
                      disabled={index === intervals.length - 1}
                      aria-label="Ниже"
                      onClick={() => moveInterval(item.key, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="coach-btn coach-btn--muted"
                      disabled={intervals.length <= 1}
                      onClick={() => removeInterval(item.key)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div className="coach-workouts__field">
                  <span className="text-secondary">Активность</span>
                  <ActivityTypePicker
                    activityTypes={compendium}
                    headingLabels={headingLabels}
                    value={item.source_activity_type_id}
                    compendiumOnly
                    emptyLabel="Выберите из справочника"
                    onChange={(id) => updateInterval(item.key, { source_activity_type_id: id })}
                  />
                </div>

                <label className="coach-workouts__field">
                  <span className="text-secondary">Подпись этапа (необязательно)</span>
                  <input
                    className="glass-input"
                    value={item.label}
                    maxLength={120}
                    placeholder="Разминка, груша…"
                    onChange={(event) => updateInterval(item.key, { label: event.target.value })}
                  />
                </label>

                <div className="coach-workouts__field">
                  <span className="text-secondary">Минуты</span>
                  <WheelNumberPicker
                    value={item.duration_min}
                    min={ACTIVITY_DURATION_MIN_MIN}
                    max={Math.min(120, ACTIVITY_DURATION_MIN_MAX)}
                    step={5}
                    unit="мин"
                    ariaLabel={`Длительность этапа ${index + 1}`}
                    onChange={(duration_min) => updateInterval(item.key, { duration_min })}
                  />
                </div>

                <p className="coach-workouts__interval-load text-muted">
                  {source ? `MET ${source.met_value} · ${load} MET·мин` : "Выберите активность"}
                </p>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="coach-btn coach-btn--muted coach-workouts__add-interval"
          onClick={() =>
            setIntervals((current) => [...current, emptyInterval(compendium[0]?.id ?? "")])
          }
        >
          + Добавить этап
        </button>

        {error ? <p className="auth-error">{error}</p> : null}

        <div className="coach-workouts__footer">
          <button
            type="button"
            className="coach-btn coach-btn--primary"
            disabled={saving || deleting}
            onClick={() => void handleSave()}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="coach-btn coach-btn--muted"
              disabled={saving || deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Удаление…" : "Удалить тренировку"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="coach-workouts">
      {onBack ? (
        <button type="button" className="coach-workouts__back text-secondary" onClick={onBack}>
          ← Настройки
        </button>
      ) : null}
      <div className="coach-workouts__list-head">
        <p className="text-secondary coach-workouts__hint">
          Соберите тренировку из справочника: этапы с минутами и средний MET для расписания.
        </p>
        <button type="button" className="coach-btn coach-btn--primary" onClick={openCreate}>
          Создать
        </button>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {workouts.length === 0 ? (
        <p className="text-muted">Пока нет своих тренировок. Создайте первую.</p>
      ) : (
        <ul className="coach-workouts__list">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <button type="button" className="coach-workouts__card glass glass--panel" onClick={() => openEdit(workout)}>
                <span className="coach-workouts__card-name">{workout.name}</span>
                <span className="coach-workouts__card-meta text-secondary">
                  MET {workout.average_met} · {workout.total_duration_min} мин · {workout.intervals.length} этап
                  {workout.intervals.length === 1 ? "" : workout.intervals.length < 5 ? "а" : "ов"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
