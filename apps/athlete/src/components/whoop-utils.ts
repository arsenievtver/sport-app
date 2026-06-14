import type {
  WhoopCycleRecord,
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopSyncPayload,
  WhoopWorkoutRecord,
} from "@sport-app/shared";

export function formatDurationMs(ms: number | undefined): string {
  if (!ms) return "—";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours} ч ${minutes} мин`;
}

export function formatShortDate(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function kilojouleToKcal(kj: number | undefined): number | null {
  if (kj == null || Number.isNaN(kj)) return null;
  return Math.round(kj / 4.184);
}

export function recoveryTone(score: number | undefined): "high" | "mid" | "low" | "none" {
  if (score == null) return "none";
  if (score >= 67) return "high";
  if (score >= 34) return "mid";
  return "low";
}

export function recoveryLabel(tone: ReturnType<typeof recoveryTone>): string {
  switch (tone) {
    case "high":
      return "Восстановлен";
    case "mid":
      return "Умеренно";
    case "low":
      return "Нужен отдых";
    default:
      return "Нет данных";
  }
}

export interface SleepStages {
  rem: number;
  deep: number;
  light: number;
  awake: number;
  total: number;
}

export function extractSleepStages(record: WhoopSleepRecord | undefined): SleepStages | null {
  const summary = record?.score?.stage_summary;
  if (!summary) return null;

  const rem = summary.total_rem_sleep_time_milli ?? 0;
  const deep = summary.total_slow_wave_sleep_time_milli ?? 0;
  const light = summary.total_light_sleep_time_milli ?? 0;
  const awake = summary.total_awake_time_milli ?? 0;
  const total = rem + deep + light + awake;

  if (total <= 0) return null;
  return { rem, deep, light, awake, total };
}

export function getDashboardSnapshot(data: WhoopSyncPayload) {
  const recoveryRecords = data.recovery?.records ?? [];
  const sleepRecords = data.sleep?.records ?? [];
  const workoutRecords = data.workouts?.records ?? [];
  const cycleRecords = data.cycles?.records ?? [];

  const latestRecovery = recoveryRecords[0];
  const latestSleep = sleepRecords[0];
  const latestCycle = cycleRecords[0];
  const latestWorkout = workoutRecords[0];

  const recoveryScore = latestRecovery?.score?.recovery_score;
  const recoveryTrend = recoveryRecords
    .slice(0, 7)
    .reverse()
    .map((record: WhoopRecoveryRecord, index) => ({
      key: record.created_at ?? `r-${index}`,
      label: formatShortDate(record.created_at),
      value: record.score?.recovery_score ?? 0,
    }));

  const sleepStages = extractSleepStages(latestSleep);

  return {
    profileName: [data.profile?.first_name, data.profile?.last_name].filter(Boolean).join(" "),
    latestRecovery,
    latestSleep,
    latestCycle,
    latestWorkout,
    recoveryScore,
    recoveryTone: recoveryTone(recoveryScore),
    recoveryTrend,
    sleepStages,
    dayStrain: latestCycle?.score?.strain,
    dayCalories: kilojouleToKcal(latestCycle?.score?.kilojoule),
    workouts: workoutRecords.slice(0, 5) as WhoopWorkoutRecord[],
    cycles: cycleRecords.slice(0, 7) as WhoopCycleRecord[],
  };
}

export type WhoopDashboardSnapshot = ReturnType<typeof getDashboardSnapshot>;
