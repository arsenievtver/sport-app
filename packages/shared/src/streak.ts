export type StreakMedalId = "streak-1m" | "streak-3m" | "streak-6m" | "streak-12m";

export interface AthleteStreakMedal {
  id: StreakMedalId | string;
  title: string;
  weeks_required: number;
  unlocked: boolean;
  stack_count: number;
  is_next: boolean;
}

export interface AthleteStreak {
  current_streak_weeks: number;
  best_streak_weeks: number;
  workouts_per_week: number;
  current_week_workouts: number;
  current_week_met: boolean;
  next_threshold_weeks: number;
  progress_weeks: number;
  progress_percent: number;
  medals_preview_unlock_all: boolean;
  medals: AthleteStreakMedal[];
  week_start: string;
}

export const STREAK_MEDAL_ASSETS: Record<
  StreakMedalId,
  { src: string; title: string; subtitle: string; glow: string }
> = {
  "streak-1m": {
    src: "/medals/streak-1m.webp",
    title: "1 месяц",
    subtitle: "Тренировок без перерыва",
    glow: "196, 122, 58",
  },
  "streak-3m": {
    src: "/medals/streak-3m.webp",
    title: "3 месяца",
    subtitle: "Тренировок без перерыва",
    glow: "186, 198, 210",
  },
  "streak-6m": {
    src: "/medals/streak-6m.webp",
    title: "6 месяцев",
    subtitle: "Тренировок без перерыва",
    glow: "232, 186, 64",
  },
  "streak-12m": {
    src: "/medals/streak-12m.webp",
    title: "1 год",
    subtitle: "Тренировок без перерыва",
    glow: "255, 156, 72",
  },
};

export const STREAK_MEDAL_ORDER: StreakMedalId[] = [
  "streak-1m",
  "streak-3m",
  "streak-6m",
  "streak-12m",
];
