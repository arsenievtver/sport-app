export const WORKOUT_WEEKLY_CHART_WEEKS = 10;

export interface AthleteWorkoutWeeklyEntry {
  week_start: string;
  workouts_count: number;
}

export interface AthleteWorkoutWeeklyDynamics {
  entries: AthleteWorkoutWeeklyEntry[];
}

export interface CountChartBounds {
  yMin: number;
  yMax: number;
}

export function computeWorkoutWeeklyChartBounds(counts: number[]): CountChartBounds {
  if (counts.length === 0) {
    return { yMin: 0, yMax: 1 };
  }

  const dataMax = Math.max(...counts);
  return {
    yMin: 0,
    yMax: Math.max(dataMax + 1, 1),
  };
}

export function countToChartY(
  value: number,
  bounds: CountChartBounds,
  chartTop: number,
  chartBottom: number,
): number {
  const span = bounds.yMax - bounds.yMin;
  if (span <= 0) return (chartTop + chartBottom) / 2;
  const ratio = (value - bounds.yMin) / span;
  return chartBottom - ratio * (chartBottom - chartTop);
}

/** Week range label, e.g. 12-19 (Mon–Sun of the week). */
export function formatWorkoutWeekRangeLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return weekStartIso;

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}-${end.getDate()}`;
  }

  const formatShort = (date: Date) =>
    `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${formatShort(start)}-${formatShort(end)}`;
}

export function formatWorkoutWeekTooltip(isoDate: string, count: number): string {
  const range = formatWorkoutWeekRangeLabel(isoDate);
  return `${range} · ${count} тр.`;
}
