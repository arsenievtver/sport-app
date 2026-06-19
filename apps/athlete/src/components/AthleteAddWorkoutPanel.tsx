import { useCallback, useEffect, useMemo, useState } from "react";
import { completeAthleteSession, fetchActivityTypes, fetchAthleteCoaches, fetchAthleteWeightDynamics } from "@sport-app/api-client";
import type { ActivityCategory, ActivityType, AthleteCoachLink } from "@sport-app/shared";
import {
  ACTIVITY_CATEGORY_LABELS,
  ACTIVITY_DURATION_MIN_MAX,
  ACTIVITY_DURATION_MIN_MIN,
  ACTIVITY_EFFORT_DEFAULT,
  ACTIVITY_EFFORT_MAX,
  ACTIVITY_EFFORT_MIN,
  ATHLETE_WORKOUT_WITHOUT_COACH,
  ATHLETE_WORKOUT_WITHOUT_COACH_LABEL,
  RECENT_ACTIVITY_TYPES_LABEL,
  calculateEffectiveMet,
  calculateLoadMetMinutes,
  calculateWorkoutCalories,
  clampActivityDurationMin,
  clampActivityEffort,
  formatCaloriesKcal,
  getActivityEffortLabel,
} from "@sport-app/shared";

interface AthleteAddWorkoutPanelProps {
  refreshKey?: string;
  embedded?: boolean;
  onWorkoutAdded?: (sessionsCompleted: number) => void;
  onGoToWeightData?: () => void;
}

const DURATION_PRESETS = [30, 45, 60, 90] as const;

function getPanelClassName(embedded: boolean): string {
  return embedded
    ? "athlete-add-workout athlete-add-workout--embedded"
    : "athlete-add-workout glass glass--panel";
}

export function AthleteAddWorkoutPanel({
  refreshKey,
  embedded = false,
  onWorkoutAdded,
  onGoToWeightData,
}: AthleteAddWorkoutPanelProps) {
  const [coaches, setCoaches] = useState<AthleteCoachLink[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [recentActivityTypeIds, setRecentActivityTypeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCoachChoice, setSelectedCoachChoice] = useState<string | null>(null);
  const [activityTypeId, setActivityTypeId] = useState("");
  const [durationMin, setDurationMin] = useState(45);
  const [effort, setEffort] = useState(ACTIVITY_EFFORT_DEFAULT);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [coachItems, activityData, weightData] = await Promise.all([
        fetchAthleteCoaches(),
        fetchActivityTypes(),
        fetchAthleteWeightDynamics(),
      ]);
      setCoaches(coachItems);
      setActivityTypes(activityData.items);
      setRecentActivityTypeIds(activityData.recent_ids);
      setCurrentWeightKg(weightData.current_weight_kg ?? null);
      setActivityTypeId((current) => {
        if (current && activityData.items.some((item) => item.id === current)) {
          return current;
        }
        const recentDefault = activityData.recent_ids.find((id) =>
          activityData.items.some((item) => item.id === id),
        );
        return recentDefault ?? activityData.items[0]?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const activeCoaches = useMemo(
    () => coaches.filter((coach) => coach.link_status === "active"),
    [coaches],
  );

  useEffect(() => {
    if (activeCoaches.length === 0) {
      setSelectedCoachChoice(ATHLETE_WORKOUT_WITHOUT_COACH);
      return;
    }
    if (activeCoaches.length === 1 && selectedCoachChoice !== ATHLETE_WORKOUT_WITHOUT_COACH) {
      setSelectedCoachChoice(activeCoaches[0].link_id);
      return;
    }
    if (
      selectedCoachChoice != null
      && selectedCoachChoice !== ATHLETE_WORKOUT_WITHOUT_COACH
      && !activeCoaches.some((coach) => coach.link_id === selectedCoachChoice)
    ) {
      setSelectedCoachChoice(null);
    }
  }, [activeCoaches, selectedCoachChoice]);

  const withoutCoach =
    activeCoaches.length === 0 || selectedCoachChoice === ATHLETE_WORKOUT_WITHOUT_COACH;
  const coachPickerRequired = activeCoaches.length > 1;
  const hasCoachSelection =
    withoutCoach || selectedCoachChoice != null;

  const selectedActivity = useMemo(
    () => activityTypes.find((item) => item.id === activityTypeId) ?? null,
    [activityTypes, activityTypeId],
  );

  const recentActivityTypes = useMemo(
    () =>
      recentActivityTypeIds
        .map((id) => activityTypes.find((item) => item.id === id))
        .filter((item): item is ActivityType => item != null),
    [activityTypes, recentActivityTypeIds],
  );

  const recentActivityTypeIdSet = useMemo(
    () => new Set(recentActivityTypes.map((item) => item.id)),
    [recentActivityTypes],
  );

  const groupedActivityTypes = useMemo(() => {
    const groups = new Map<ActivityCategory, ActivityType[]>();
    for (const item of activityTypes) {
      if (recentActivityTypeIdSet.has(item.id)) {
        continue;
      }
      const bucket = groups.get(item.category) ?? [];
      bucket.push(item);
      groups.set(item.category, bucket);
    }
    return [...groups.entries()].sort(([left], [right]) =>
      ACTIVITY_CATEGORY_LABELS[left].localeCompare(ACTIVITY_CATEGORY_LABELS[right], "ru"),
    );
  }, [activityTypes, recentActivityTypeIdSet]);

  const previewLoad = useMemo(() => {
    if (!selectedActivity) return null;
    return calculateLoadMetMinutes(selectedActivity.met_value, durationMin, effort);
  }, [selectedActivity, durationMin, effort]);

  const previewCalories = useMemo(() => {
    if (!selectedActivity || currentWeightKg == null) return null;
    const effectiveMet = calculateEffectiveMet(selectedActivity.met_value, effort);
    return calculateWorkoutCalories(effectiveMet, durationMin, currentWeightKg);
  }, [selectedActivity, currentWeightKg, durationMin, effort]);

  const handleAddWorkout = async () => {
    if (coachPickerRequired && !hasCoachSelection) {
      setError("Выбери тренера или «Без тренера»");
      return;
    }
    if (!activityTypeId) {
      setError("Выбери вид тренировки");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await completeAthleteSession({
        ...(withoutCoach
          ? { without_coach: true }
          : { link_id: selectedCoachChoice ?? activeCoaches[0]?.link_id }),
        activity_type_id: activityTypeId,
        duration_min: clampActivityDurationMin(durationMin),
        effort: clampActivityEffort(effort),
      });
      onWorkoutAdded?.(result.sessions_completed);
      setRecentActivityTypeIds((current) => {
        const next = [activityTypeId, ...current.filter((id) => id !== activityTypeId)];
        return next.slice(0, 6);
      });
      const loadText =
        result.load_met_minutes != null ? ` · нагрузка ${result.load_met_minutes} MET·мин` : "";
      const caloriesText =
        result.calories_kcal != null ? ` · ~${formatCaloriesKcal(result.calories_kcal)} ккал` : "";
      setNotice(
        `${result.activity_name ?? "Тренировка"} ${result.duration_min ?? durationMin} мин${loadText}${caloriesText}`,
      );
      setEffort(ACTIVITY_EFFORT_DEFAULT);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отметить тренировку");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className={getPanelClassName(embedded)}>
        <p className="text-muted">Загрузка…</p>
      </section>
    );
  }

  return (
    <section className={getPanelClassName(embedded)}>
      {activeCoaches.length >= 1 ? (
        <div className="athlete-add-workout__coach-picker">
          <p className="athlete-add-workout__label text-secondary">Тренер</p>
          <div className="athlete-add-workout__coach-options">
            {activeCoaches.map((coach) => {
              const selected = selectedCoachChoice === coach.link_id;
              return (
                <button
                  key={coach.link_id}
                  type="button"
                  className={`athlete-add-workout__coach-option${selected ? " athlete-add-workout__coach-option--selected" : ""}`}
                  disabled={busy}
                  onClick={() => setSelectedCoachChoice(coach.link_id)}
                >
                  {coach.display_name}
                </button>
              );
            })}
            <button
              type="button"
              className={`athlete-add-workout__coach-option${selectedCoachChoice === ATHLETE_WORKOUT_WITHOUT_COACH ? " athlete-add-workout__coach-option--selected" : ""}`}
              disabled={busy}
              onClick={() => setSelectedCoachChoice(ATHLETE_WORKOUT_WITHOUT_COACH)}
            >
              {ATHLETE_WORKOUT_WITHOUT_COACH_LABEL}
            </button>
          </div>
        </div>
      ) : null}

      <div className="athlete-add-workout__field">
        <label className="athlete-add-workout__label text-secondary" htmlFor="activity-type">
          Вид тренировки
        </label>
        <select
          id="activity-type"
          className="athlete-add-workout__select"
          value={activityTypeId}
          disabled={busy || activityTypes.length === 0}
          onChange={(event) => setActivityTypeId(event.target.value)}
        >
          {recentActivityTypes.length > 0 ? (
            <optgroup label={RECENT_ACTIVITY_TYPES_LABEL}>
              {recentActivityTypes.map((item) => (
                <option key={`recent-${item.id}`} value={item.id} title={item.name_en}>
                  {item.name_ru} · MET {item.met_value}
                </option>
              ))}
            </optgroup>
          ) : null}
          {groupedActivityTypes.map(([category, items]) => (
            <optgroup key={category} label={ACTIVITY_CATEGORY_LABELS[category]}>
              {items.map((item) => (
                <option key={item.id} value={item.id} title={item.name_en}>
                  {item.name_ru} · MET {item.met_value}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="athlete-add-workout__field">
        <label className="athlete-add-workout__label text-secondary" htmlFor="duration-min">
          Длительность, мин
        </label>
        <div className="athlete-add-workout__duration-row">
          <input
            id="duration-min"
            type="number"
            className="athlete-add-workout__input"
            min={ACTIVITY_DURATION_MIN_MIN}
            max={ACTIVITY_DURATION_MIN_MAX}
            step={5}
            value={durationMin}
            disabled={busy}
            onChange={(event) => setDurationMin(clampActivityDurationMin(Number(event.target.value)))}
          />
          <div className="athlete-add-workout__duration-presets">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`athlete-add-workout__duration-preset${durationMin === preset ? " athlete-add-workout__duration-preset--selected" : ""}`}
                disabled={busy}
                onClick={() => setDurationMin(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="athlete-add-workout__field">
        <div className="athlete-add-workout__effort-header">
          <span className="athlete-add-workout__label text-secondary">Усилие</span>
          <span className="athlete-add-workout__effort-value">{getActivityEffortLabel(effort)}</span>
        </div>
        <input
          type="range"
          className="athlete-add-workout__effort-input"
          min={ACTIVITY_EFFORT_MIN}
          max={ACTIVITY_EFFORT_MAX}
          step={1}
          value={effort}
          disabled={busy}
          aria-label="Усилие тренировки"
          onChange={(event) => setEffort(clampActivityEffort(Number(event.target.value)))}
        />
        <div className="athlete-add-workout__effort-scale">
          <span>Легко</span>
          <span>До отказа</span>
        </div>
      </div>

      {previewLoad != null ? (
        <p className="athlete-add-workout__preview text-secondary">
          Оценка нагрузки: <strong>{previewLoad} MET·мин</strong>
          {previewCalories != null ? (
            <>
              {" "}
              · ~<strong>{formatCaloriesKcal(previewCalories)} ккал</strong>
            </>
          ) : null}
        </p>
      ) : null}

      {!loading && currentWeightKg == null ? (
        <p className="athlete-add-workout__weight-hint text-secondary">
          Для оценки калорий укажи вес в разделе «Данные».
          {onGoToWeightData ? (
            <>
              {" "}
              <button
                type="button"
                className="athlete-add-workout__weight-link"
                disabled={busy}
                onClick={onGoToWeightData}
              >
                Перейти к данным
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-outline btn-outline--primary btn--block"
        disabled={busy || (coachPickerRequired && !hasCoachSelection) || !activityTypeId}
        onClick={() => void handleAddWorkout()}
      >
        {busy ? "Сохраняем…" : "Добавить тренировку"}
      </button>

      {notice ? <p className="athlete-add-workout__notice text-secondary">{notice}</p> : null}
      {error ? <p className="auth-error athlete-add-workout__error">{error}</p> : null}
    </section>
  );
}
