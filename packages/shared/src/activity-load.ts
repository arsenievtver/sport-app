/** Effort scale 1 (very light) … 10 (to failure). MET multiplier range for compendium baseline. */
export const ACTIVITY_EFFORT_MIN = 1;
export const ACTIVITY_EFFORT_MAX = 10;
export const ACTIVITY_EFFORT_DEFAULT = 5;

export const ACTIVITY_DURATION_MIN_MIN = 5;
export const ACTIVITY_DURATION_MIN_MAX = 600;

const EFFORT_MET_MULTIPLIER_MIN = 0.65;
const EFFORT_MET_MULTIPLIER_MAX = 1.45;

export const ACTIVITY_EFFORT_LABELS: Record<number, string> = {
  1: "Очень легко",
  2: "Легко",
  3: "Спокойно",
  4: "Умеренно",
  5: "Средне",
  6: "Средне-тяжело",
  7: "Тяжело",
  8: "Очень тяжело",
  9: "Почти до отказа",
  10: "До отказа",
};

export function clampActivityEffort(value: number): number {
  return Math.max(ACTIVITY_EFFORT_MIN, Math.min(ACTIVITY_EFFORT_MAX, Math.round(value)));
}

export function clampActivityDurationMin(value: number): number {
  return Math.max(
    ACTIVITY_DURATION_MIN_MIN,
    Math.min(ACTIVITY_DURATION_MIN_MAX, Math.round(value)),
  );
}

/** Scales compendium MET (typical intensity) by subjective effort. */
export function effortMetMultiplier(effort: number): number {
  const clamped = clampActivityEffort(effort);
  return (
    EFFORT_MET_MULTIPLIER_MIN +
    ((clamped - ACTIVITY_EFFORT_MIN) * (EFFORT_MET_MULTIPLIER_MAX - EFFORT_MET_MULTIPLIER_MIN)) /
      (ACTIVITY_EFFORT_MAX - ACTIVITY_EFFORT_MIN)
  );
}

export function calculateEffectiveMet(baseMet: number, effort: number): number {
  return Math.round(baseMet * effortMetMultiplier(effort) * 100) / 100;
}

/** MET-minutes — weight-independent load metric (WHO PA guidelines). */
export function calculateLoadMetMinutes(
  baseMet: number,
  durationMin: number,
  effort: number,
): number {
  return Math.round(calculateEffectiveMet(baseMet, effort) * durationMin * 10) / 10;
}

/** kcal ≈ effective MET × weight(kg) × hours (Compendium). */
export function calculateWorkoutCalories(
  effectiveMet: number,
  durationMin: number,
  weightKg: number,
): number {
  return Math.round(effectiveMet * weightKg * (durationMin / 60) * 10) / 10;
}

export function formatCaloriesKcal(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}`;
}

export function getActivityEffortLabel(effort: number): string {
  return ACTIVITY_EFFORT_LABELS[clampActivityEffort(effort)] ?? "Средне";
}
