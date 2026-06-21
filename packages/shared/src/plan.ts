import type { Gender } from "./athlete";
import { calculateAge } from "./athlete";

export type PlanActivityTier = "light" | "moderate" | "active" | "very_active";

export const DEFAULT_PLAN_WORKOUTS_PER_WEEK = 2;
export const DEFAULT_PLAN_ACTIVITY_TIER: PlanActivityTier = "moderate";
export const SEDENTARY_PAL = 1.2;
export const ESTIMATED_BMI = 22.5;

export const PLAN_WORKOUT_OPTIONS = [1, 2, 3, 4, 5] as const;

export const WHO_PHYSICAL_ACTIVITY_URL =
  "https://www.who.int/news-room/fact-sheets/detail/physical-activity";

export interface ActivityTierSpec {
  id: PlanActivityTier;
  label: string;
  shortLabel: string;
  pal: number;
  weeklyActivityMin: number;
  description: string;
}

export const ACTIVITY_TIER_SPECS: ActivityTierSpec[] = [
  {
    id: "light",
    label: "Лёгкая активность",
    shortLabel: "Лёгкая",
    pal: 1.375,
    weeklyActivityMin: 150,
    description: "Минимум ВОЗ — около 150 мин умеренной активности в неделю",
  },
  {
    id: "moderate",
    label: "Умеренная активность",
    shortLabel: "Умеренная",
    pal: 1.55,
    weeklyActivityMin: 225,
    description: "Между минимумом и верхней границей рекомендаций ВОЗ",
  },
  {
    id: "active",
    label: "Активный образ жизни",
    shortLabel: "Активная",
    pal: 1.725,
    weeklyActivityMin: 300,
    description: "Верхняя граница ВОЗ для существенной пользы (~300 мин/нед)",
  },
  {
    id: "very_active",
    label: "Высокая активность",
    shortLabel: "Высокая",
    pal: 1.9,
    weeklyActivityMin: 450,
    description: "Повышенный уровень для интенсивного спортивного режима",
  },
];

export function getActivityTierSpec(tier: PlanActivityTier): ActivityTierSpec {
  return ACTIVITY_TIER_SPECS.find((item) => item.id === tier) ?? ACTIVITY_TIER_SPECS[1]!;
}

export interface AthletePlan {
  workouts_per_week: number;
  activity_tier: PlanActivityTier;
  sedentary_daily_kcal: number | null;
  target_daily_kcal: number | null;
  target_weekly_activity_min: number;
  target_daily_activity_min: number;
  current_weight_kg?: number | null;
}

export interface AthletePlanUpdatePayload {
  workouts_per_week?: number;
  activity_tier?: PlanActivityTier;
}

export interface AthleteWeekProgressMetric {
  label: string;
  actual: number;
  target: number;
  unit: string;
  percent: number;
}

export interface AthleteWeekProgress {
  week_start: string;
  week_end: string;
  completion_percent: number;
  workouts: AthleteWeekProgressMetric;
  calories: AthleteWeekProgressMetric;
  activity: AthleteWeekProgressMetric;
}

function estimateHeightCm(weightKg: number): number {
  const heightM = (weightKg / ESTIMATED_BMI) ** 0.5;
  return heightM * 100;
}

export function calculateBmrKcal(
  weightKg: number,
  gender: Gender | null | undefined,
  birthDate: string | null | undefined,
  today = new Date(),
): number {
  const age = calculateAge(birthDate, today) ?? 30;
  const heightCm = estimateHeightCm(weightKg);

  const bmr =
    gender === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

  return Math.round(Math.max(bmr, 800));
}

export function calculateSedentaryDailyKcal(
  weightKg: number,
  gender: Gender | null | undefined,
  birthDate: string | null | undefined,
  today = new Date(),
): number {
  return Math.round(calculateBmrKcal(weightKg, gender, birthDate, today) * SEDENTARY_PAL);
}

export function calculateTargetDailyKcal(
  weightKg: number,
  gender: Gender | null | undefined,
  birthDate: string | null | undefined,
  pal: number,
  today = new Date(),
): number {
  return Math.round(calculateBmrKcal(weightKg, gender, birthDate, today) * pal);
}

export function formatWeekProgressMetric(metric: AthleteWeekProgressMetric): string {
  if (metric.label === "Тренировки") {
    return `${Math.round(metric.actual)} / ${Math.round(metric.target)}`;
  }
  if (metric.unit === "ккал") {
    const actual = Math.round(metric.actual).toLocaleString("ru-RU");
    const target = Math.round(metric.target).toLocaleString("ru-RU");
    return `${actual} / ${target}`;
  }
  if (metric.unit === "мин/день") {
    const formatMin = (value: number): string => {
      const rounded = Math.round(value);
      if (rounded >= 60) {
        const hours = Math.floor(rounded / 60);
        const mins = rounded % 60;
        return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
      }
      return `${rounded}`;
    };
    return `${formatMin(metric.actual)} / ${formatMin(metric.target)}`;
  }
  return `${Math.round(metric.actual)} / ${Math.round(metric.target)} ${metric.unit}`.trim();
}

export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  const startLabel = start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return `${startLabel} — ${endLabel}`;
}

export function formatDailyActivityMin(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours} ч ${mins} мин/день` : `${hours} ч/день`;
  }
  return `${Math.round(minutes)} мин/день`;
}
