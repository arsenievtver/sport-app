import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAthletePlan, updateAthletePlan } from "@sport-app/api-client";
import {
  ACTIVITY_TIER_SPECS,
  DEFAULT_PLAN_ACTIVITY_TIER,
  DEFAULT_PLAN_WORKOUTS_PER_WEEK,
  PLAN_WORKOUT_OPTIONS,
  SEDENTARY_PAL,
  WHO_PHYSICAL_ACTIVITY_URL,
  formatDailyActivityMin,
  getActivityTierSpec,
  type AthletePlan,
  type PlanActivityTier,
} from "@sport-app/shared";
import "./athlete-plan.css";

interface AthleteMyPlanPanelProps {
  onBack: () => void;
  onSaved?: () => void;
}

interface SavedPlanSnapshot {
  workoutsPerWeek: number;
  activityTier: PlanActivityTier;
}

export function AthleteMyPlanPanel({ onBack, onSaved }: AthleteMyPlanPanelProps) {
  const [plan, setPlan] = useState<AthletePlan | null>(null);
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState(DEFAULT_PLAN_WORKOUTS_PER_WEEK);
  const [activityTier, setActivityTier] = useState<PlanActivityTier>(DEFAULT_PLAN_ACTIVITY_TIER);
  const [savedSnapshot, setSavedSnapshot] = useState<SavedPlanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierSpec = useMemo(() => getActivityTierSpec(activityTier), [activityTier]);

  const previewTargetKcal = useMemo(() => {
    if (plan?.sedentary_daily_kcal == null) return null;
    return Math.round(plan.sedentary_daily_kcal * (tierSpec.pal / SEDENTARY_PAL));
  }, [plan?.sedentary_daily_kcal, tierSpec.pal]);

  const previewDailyActivityMin = Math.round(tierSpec.weeklyActivityMin / 7);

  const hasChanges =
    savedSnapshot != null &&
    (workoutsPerWeek !== savedSnapshot.workoutsPerWeek ||
      activityTier !== savedSnapshot.activityTier);

  const applySnapshot = useCallback((data: AthletePlan) => {
    setSavedSnapshot({
      workoutsPerWeek: data.workouts_per_week,
      activityTier: data.activity_tier,
    });
    setWorkoutsPerWeek(data.workouts_per_week);
    setActivityTier(data.activity_tier);
  }, []);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAthletePlan();
      setPlan(data);
      applySnapshot(data);
      setSaveSucceeded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить план");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    if (!saveSucceeded) return;
    const timer = window.setTimeout(() => {
      onSaved?.();
      onBack();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [saveSucceeded, onBack, onSaved]);

  const handleSave = async () => {
    if (!hasChanges || saving || saveSucceeded) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await updateAthletePlan({
        workouts_per_week: workoutsPerWeek,
        activity_tier: activityTier,
      });
      setPlan(updated);
      applySnapshot(updated);
      setSaveSucceeded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saving ? "Сохранение…" : saveSucceeded ? "Сохранено" : "Сохранить план";

  const sedentaryKcal = plan?.sedentary_daily_kcal;
  const targetKcal = previewTargetKcal;
  const targetDailyActivity = previewDailyActivityMin;

  return (
    <div className="athlete-overlay-screen">
      {loading ? (
        <p className="text-muted">Загрузка…</p>
      ) : (
        <div className="athlete-my-plan">
          <section className="athlete-my-plan__section athlete-my-plan__section--plain">
            <h2 className="athlete-my-plan__section-title">Тренировки в неделю</h2>
            <p className="athlete-my-plan__lead text-secondary">
              Сколько раз в неделю вы планируете заниматься. Прогресс на главной считается по
              завершённым активностям.
            </p>
            <div className="athlete-plan-chips" role="group" aria-label="Тренировок в неделю">
              {PLAN_WORKOUT_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`athlete-plan-chips__item${workoutsPerWeek === value ? " athlete-plan-chips__item--selected" : ""}`}
                  disabled={saving || saveSucceeded}
                  aria-pressed={workoutsPerWeek === value}
                  onClick={() => {
                    setSaveSucceeded(false);
                    setWorkoutsPerWeek(value);
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          </section>

          <section className="athlete-my-plan__section athlete-my-plan__section--plain">
            <h2 className="athlete-my-plan__section-title">Уровень активности</h2>
            <p className="athlete-my-plan__lead text-secondary">
              Цель по расходу энергии и времени движения. Чем выше уровень — тем больше минут
              активности и калорий в день мы ожидаем от вашего образа жизни.
            </p>
            <div className="athlete-plan-tier-list" role="radiogroup" aria-label="Уровень активности">
              {ACTIVITY_TIER_SPECS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  className={`athlete-plan-tier${activityTier === tier.id ? " athlete-plan-tier--selected" : ""}`}
                  disabled={saving || saveSucceeded}
                  role="radio"
                  aria-checked={activityTier === tier.id}
                  onClick={() => {
                    setSaveSucceeded(false);
                    setActivityTier(tier.id);
                  }}
                >
                  <span className="athlete-plan-tier__label">{tier.label}</span>
                  <span className="athlete-plan-tier__meta text-muted">
                    PAL {tier.pal} · {tier.weeklyActivityMin} мин/нед
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="athlete-my-plan__section glass glass--panel">
            <h2 className="athlete-my-plan__section-title">Ваши цели</h2>
            <ul className="athlete-my-plan__targets">
              <li>
                <span className="text-secondary">Тренировки</span>
                <strong>{workoutsPerWeek} в неделю</strong>
              </li>
              <li>
                <span className="text-secondary">Расход энергии</span>
                <strong>
                  {targetKcal != null
                    ? `~${Math.round(targetKcal).toLocaleString("ru-RU")} ккал/день`
                    : "—"}
                </strong>
              </li>
              <li>
                <span className="text-secondary">Активность</span>
                <strong>{formatDailyActivityMin(targetDailyActivity)}</strong>
              </li>
              <li>
                <span className="text-secondary">Без нагрузки (база)</span>
                <strong>
                  {sedentaryKcal != null
                    ? `~${Math.round(sedentaryKcal).toLocaleString("ru-RU")} ккал/день`
                    : "—"}
                </strong>
              </li>
            </ul>
            {!plan?.current_weight_kg ? (
              <p className="athlete-my-plan__hint text-muted">
                Добавьте вес на вкладке «Данные», чтобы рассчитать цели по энергии.
              </p>
            ) : null}
          </section>

          <section className="athlete-my-plan__section athlete-my-plan__science">
            <h2 className="athlete-my-plan__section-title">Как это считается</h2>
            <div className="athlete-my-plan__lead text-secondary">
              <p>
                <strong>Расход энергии.</strong> Базовый обмен (BMR) — формула Mifflin–St Jeor по
                весу, полу и возрасту. Без нагрузки используем коэффициент PAL {SEDENTARY_PAL}{" "}
                (сидячий образ жизни). Целевой расход — BMR × PAL уровня активности (
                {tierSpec.pal} для «{tierSpec.shortLabel}»). Калории от записанных тренировок и
                прогулок добавляются сверх базы.
              </p>
              <p>
                <strong>Активность.</strong> Цель в минутах в день выводится из недельной нормы
                ВОЗ для выбранного уровня: {tierSpec.weeklyActivityMin} мин/нед ≈{" "}
                {formatDailyActivityMin(Math.round(tierSpec.weeklyActivityMin / 7))}. В прогресс
                идёт время из записанных активностей.
              </p>
              <p>
                <strong>Тренировки.</strong> Сравниваем число завершённых активностей за неделю с
                вашим планом ({workoutsPerWeek}).
              </p>
              <p>
                Источник рекомендаций по движению:{" "}
                <a href={WHO_PHYSICAL_ACTIVITY_URL} target="_blank" rel="noopener noreferrer">
                  WHO — Physical activity
                </a>
                . Коэффициенты PAL — общепринятые множители суточного расхода энергии (FAO/WHO).
              </p>
            </div>
          </section>

          {error ? <p className="auth-error">{error}</p> : null}

          <div className="athlete-my-plan__footer">
            {hasChanges && !saveSucceeded ? (
              <p className="athlete-my-plan__footer-hint text-muted">Есть несохранённые изменения</p>
            ) : null}
            <button
              type="button"
              className={`athlete-my-plan__save settings-btn settings-btn--primary${saveSucceeded ? " athlete-my-plan__save--success" : ""}${!hasChanges ? " athlete-my-plan__save--idle" : ""}`}
              disabled={!hasChanges || saving || saveSucceeded}
              onClick={() => void handleSave()}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
