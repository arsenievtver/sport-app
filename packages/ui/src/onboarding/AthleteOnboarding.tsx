import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { completeAthleteOnboarding } from "@sport-app/api-client";
import {
  FOCUS_IMPORTANCE_DEFAULT,
  GENDER_LABELS,
  TRAINING_TRAIT_LABELS,
  type Gender,
  type TrainingTrait,
  type UserResponse,
} from "@sport-app/shared";

import {
  ONBOARDING_CTA,
  ONBOARDING_GOAL_EXAMPLES,
  ONBOARDING_STEP_COPY,
  ONBOARDING_WELCOME,
} from "./onboarding-content";
import { ONBOARDING_STEPS } from "./onboarding-types";
import { setSessionRefreshPaused } from "../auth/useAuthSession";
import { FocusImportanceSlider } from "./FocusImportanceSlider";
import { NativeTemporalInput } from "../native-temporal/NativeTemporalInput";

const TRAINING_TRAITS: TrainingTrait[] = ["strength", "flexibility", "endurance", "coordination"];

const DEFAULT_FOCUS: Record<TrainingTrait, number> = {
  strength: FOCUS_IMPORTANCE_DEFAULT,
  flexibility: FOCUS_IMPORTANCE_DEFAULT,
  endurance: FOCUS_IMPORTANCE_DEFAULT,
  coordination: FOCUS_IMPORTANCE_DEFAULT,
};

interface AthleteOnboardingProps {
  displayName: string;
  onComplete: (user: UserResponse) => void;
}

function defaultBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return d.toISOString().slice(0, 10);
}

function parseOptionalWeight(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function handleEnterAsNext(e: KeyboardEvent, onNext: () => void) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  onNext();
}

export function AthleteOnboarding({ displayName, onComplete }: AthleteOnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState(defaultBirthDate());
  const [focus, setFocus] = useState<Record<TrainingTrait, number>>(DEFAULT_FOCUS);
  const [weightMin, setWeightMin] = useState("");
  const [weightMax, setWeightMax] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitLockRef = useRef(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const copy = ONBOARDING_STEP_COPY[step];
  const isFirstStep = stepIndex === 0;
  const isGoalStep = step === "goal";

  useEffect(() => {
    setSessionRefreshPaused(true);
    return () => setSessionRefreshPaused(false);
  }, []);

  const setTraitFocus = (trait: TrainingTrait, value: number) => {
    setFocus((prev) => ({ ...prev, [trait]: value }));
  };

  const canNext =
    step === "gender"
      ? gender !== null
      : step === "birth"
        ? birthDate.length > 0
        : true;

  const goNext = () => {
    if (!canNext || isGoalStep) return;
    setError(null);
    setStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const submitOnboarding = async () => {
    if (!isGoalStep || gender === null || loading || submitLockRef.current) return;

    const minKg = parseOptionalWeight(weightMin);
    const maxKg = parseOptionalWeight(weightMax);
    if (minKg !== null && maxKg !== null && minKg > maxKg) {
      setError("Минимальный вес не может быть больше максимального");
      return;
    }

    const titleTrimmed = goalTitle.trim();
    const targetValue = parseOptionalNumber(goalTarget);
    const hasTitle = titleTrimmed.length > 0;
    const hasTarget = goalTarget.trim().length > 0;

    if (hasTitle && !hasTarget) {
      setError("Укажите числовое значение цели или оставьте поля пустыми");
      return;
    }
    if (hasTarget && !hasTitle) {
      setError("Добавьте название цели или оставьте поля пустыми");
      return;
    }
    if (targetValue !== null && targetValue < 0) {
      setError("Значение цели не может быть отрицательным");
      return;
    }

    setError(null);
    setLoading(true);
    submitLockRef.current = true;
    try {
      const user = await completeAthleteOnboarding({
        gender,
        birth_date: birthDate,
        focus_strength: focus.strength,
        focus_flexibility: focus.flexibility,
        focus_endurance: focus.endurance,
        focus_coordination: focus.coordination,
        weight_target_min_kg: minKg,
        weight_target_max_kg: maxKg,
        personal_goal_title: hasTitle ? titleTrimmed : null,
        personal_goal_target: targetValue,
      });
      onComplete(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      submitLockRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen onboarding">
      <div className="auth-screen__bg" />
      <div className="auth-screen__content onboarding__content">
        <header className="onboarding__header">
          <p className="onboarding__greeting">
            {displayName}, добро пожаловать
          </p>
          {isFirstStep ? (
            <p className="onboarding__welcome text-secondary">{ONBOARDING_WELCOME}</p>
          ) : null}
          <h1 className="onboarding__title">{copy.title}</h1>
          <p className="onboarding__hook">{copy.headerLine}</p>
          <p className="onboarding__meta text-muted">
            <span className="onboarding__meta-label">{copy.progressLabel}</span>
            · шаг {stepIndex + 1} из {ONBOARDING_STEPS.length}
          </p>
          <div className="onboarding__progress" aria-hidden>
            {ONBOARDING_STEPS.map((s, i) => (
              <span
                key={s}
                className={`onboarding__dot${i <= stepIndex ? " onboarding__dot--active" : ""}${i === stepIndex ? " onboarding__dot--current" : ""}`}
              />
            ))}
          </div>
        </header>

        <div className="auth-card onboarding__card">
          {copy.lead ? <p className="onboarding__lead text-secondary">{copy.lead}</p> : null}

          {step === "gender" && (
            <div className="onboarding__options">
              {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`onboarding__option${gender === g ? " onboarding__option--selected" : ""}`}
                  onClick={() => setGender(g)}
                >
                  {GENDER_LABELS[g]}
                </button>
              ))}
            </div>
          )}

          {step === "birth" && (
            <label className="onboarding__field">
              <span>Дата рождения</span>
              <NativeTemporalInput
                type="date"
                wrapperClassName="onboarding__temporal"
                className="onboarding__input"
                value={birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setBirthDate(event.target.value)}
                onKeyDown={(event) => handleEnterAsNext(event, goNext)}
              />
            </label>
          )}

          {step === "focus" && (
            <div className="onboarding__importance-list">
              {TRAINING_TRAITS.map((trait) => (
                <FocusImportanceSlider
                  key={trait}
                  label={TRAINING_TRAIT_LABELS[trait]}
                  value={focus[trait]}
                  onChange={(v) => setTraitFocus(trait, v)}
                />
              ))}
            </div>
          )}

          {step === "weight" && (
            <div className="onboarding__weight-row">
              <label className="onboarding__field">
                <span>Нижняя граница, кг</span>
                <input
                  type="number"
                  className="onboarding__input"
                  min={20}
                  max={300}
                  step={0.1}
                  placeholder="68"
                  value={weightMin}
                  onChange={(e) => setWeightMin(e.target.value)}
                  onKeyDown={(e) => handleEnterAsNext(e, goNext)}
                />
              </label>
              <label className="onboarding__field">
                <span>Верхняя граница, кг</span>
                <input
                  type="number"
                  className="onboarding__input"
                  min={20}
                  max={300}
                  step={0.1}
                  placeholder="72"
                  value={weightMax}
                  onChange={(e) => setWeightMax(e.target.value)}
                  onKeyDown={(e) => handleEnterAsNext(e, goNext)}
                />
              </label>
            </div>
          )}

          {step === "goal" && (
            <div className="onboarding__personal-goal">
              <p className="onboarding__examples text-muted">
                Идеи: {ONBOARDING_GOAL_EXAMPLES}
              </p>
              <label className="onboarding__field">
                <span>Название цели</span>
                <input
                  type="text"
                  className="onboarding__input"
                  maxLength={200}
                  placeholder="Пробежать без остановки"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
              </label>
              <label className="onboarding__field">
                <span>Целевое значение</span>
                <input
                  type="number"
                  className="onboarding__input"
                  min={0}
                  step="any"
                  placeholder="5"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
                <span className="onboarding__field-hint text-muted">
                  км, раз, минуты, см — в тех единицах, которые для вас значимы
                </span>
              </label>
            </div>
          )}

          {error ? <p className="auth-error">{error}</p> : null}

          <div className="onboarding__actions">
            {stepIndex > 0 ? (
              <button type="button" className="auth-switch__link" onClick={goBack} disabled={loading}>
                {ONBOARDING_CTA.back}
              </button>
            ) : (
              <span />
            )}
            {isGoalStep ? (
              <button
                type="button"
                className="auth-submit"
                disabled={loading}
                onClick={() => void submitOnboarding()}
              >
                {loading ? ONBOARDING_CTA.saving : ONBOARDING_CTA.finish}
              </button>
            ) : (
              <button type="button" className="auth-submit" onClick={goNext} disabled={!canNext}>
                {ONBOARDING_CTA.next}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
