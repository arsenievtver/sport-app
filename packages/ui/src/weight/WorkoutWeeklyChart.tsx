import { useMemo, useState } from "react";
import type { AthleteWorkoutWeeklyEntry } from "@sport-app/shared";
import {
  computeWorkoutWeeklyChartBounds,
  countToChartY,
  formatWorkoutWeekTooltip,
} from "@sport-app/shared";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 200;
const PLOT_LEFT = 40;
const PLOT_RIGHT = 308;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 168;

interface WeekChartPoint {
  x: number;
  workoutY: number;
  activityY: number;
  entry: AthleteWorkoutWeeklyEntry;
}

function buildWeekChartPoints(
  entries: AthleteWorkoutWeeklyEntry[],
  bounds: ReturnType<typeof computeWorkoutWeeklyChartBounds>,
): WeekChartPoint[] {
  if (entries.length === 0) return [];
  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const step = entries.length === 1 ? 0 : plotWidth / (entries.length - 1);

  return entries.map((entry, index) => ({
    entry,
    x: PLOT_LEFT + step * index,
    workoutY: countToChartY(entry.workouts_count, bounds, PLOT_TOP, PLOT_BOTTOM),
    activityY: countToChartY(entry.other_activity_count, bounds, PLOT_TOP, PLOT_BOTTOM),
  }));
}

function buildSmoothLinePath(points: WeekChartPoint[], yKey: "workoutY" | "activityY"): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0][yKey]}`;

  let path = `M ${points[0].x} ${points[0][yKey]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;

    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current[yKey] + (next[yKey] - previous[yKey]) / 6;
    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next[yKey] - (following[yKey] - current[yKey]) / 6;

    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next[yKey]}`;
  }
  return path;
}

function buildCountTicks(bounds: ReturnType<typeof computeWorkoutWeeklyChartBounds>): number[] {
  if (bounds.yMax <= 2) {
    return [0, 1, bounds.yMax];
  }
  const mid = Math.round((bounds.yMin + bounds.yMax) / 2);
  return [bounds.yMin, mid, bounds.yMax];
}

export interface WorkoutWeeklyChartProps {
  entries: AthleteWorkoutWeeklyEntry[];
}

export function WorkoutWeeklyChart({ entries }: WorkoutWeeklyChartProps) {
  const [hoveredWeek, setHoveredWeek] = useState<string | null>(null);
  const bounds = useMemo(
    () =>
      computeWorkoutWeeklyChartBounds(
        entries.flatMap((entry) => [entry.workouts_count, entry.other_activity_count]),
      ),
    [entries],
  );
  const points = useMemo(() => buildWeekChartPoints(entries, bounds), [bounds, entries]);
  const workoutLinePath = useMemo(() => buildSmoothLinePath(points, "workoutY"), [points]);
  const activityLinePath = useMemo(() => buildSmoothLinePath(points, "activityY"), [points]);
  const yTicks = useMemo(() => buildCountTicks(bounds), [bounds]);
  const hoveredPoint = useMemo(
    () => points.find((point) => point.entry.week_start === hoveredWeek) ?? null,
    [hoveredWeek, points],
  );

  if (entries.length === 0) {
    return (
      <div className="weight-dynamics__chart-empty">
        <p className="text-secondary">Нет данных за выбранный период.</p>
      </div>
    );
  }

  const tooltipTopY = hoveredPoint
    ? Math.min(hoveredPoint.workoutY, hoveredPoint.activityY)
    : 0;

  return (
    <div className="workout-weekly-chart weight-dynamics__chart-wrap">
      {hoveredPoint ? (
        <div
          className="weight-dynamics__tooltip"
          style={{
            left: `${(hoveredPoint.x / CHART_WIDTH) * 100}%`,
            top: `${(tooltipTopY / CHART_HEIGHT) * 100}%`,
          }}
        >
          {formatWorkoutWeekTooltip(
            hoveredPoint.entry.week_start,
            hoveredPoint.entry.workouts_count,
            hoveredPoint.entry.other_activity_count,
          )}
        </div>
      ) : null}
      <svg
        className="weight-dynamics__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="График динамики тренировок и прочей активности по неделям"
        onMouseLeave={() => setHoveredWeek(null)}
      >
        {yTicks.map((tick) => {
          const y = countToChartY(tick, bounds, PLOT_TOP, PLOT_BOTTOM);
          return (
            <g key={tick}>
              <line
                className="weight-dynamics__grid-line"
                x1={PLOT_LEFT}
                x2={PLOT_RIGHT}
                y1={y}
                y2={y}
              />
              <text className="weight-dynamics__axis-label weight-dynamics__axis-label--y" x={4} y={y + 4}>
                {tick}
              </text>
            </g>
          );
        })}

        {points.length > 1 ? (
          <>
            <path className="weight-dynamics__line workout-weekly-chart__line--activity" d={activityLinePath} />
            <path className="weight-dynamics__line workout-weekly-chart__line--workouts" d={workoutLinePath} />
          </>
        ) : null}

        {points.map((point) => {
          const isHovered = hoveredWeek === point.entry.week_start;
          return (
            <g key={point.entry.week_start}>
              <rect
                className="workout-weekly-chart__week-hit"
                x={point.x - 14}
                y={PLOT_TOP}
                width={28}
                height={PLOT_BOTTOM - PLOT_TOP}
                onMouseEnter={() => setHoveredWeek(point.entry.week_start)}
                onTouchStart={() => setHoveredWeek(point.entry.week_start)}
              />
              <circle
                className={`workout-weekly-chart__point workout-weekly-chart__point--activity${isHovered ? " workout-weekly-chart__point--active" : ""}`}
                cx={point.x}
                cy={point.activityY}
                r={isHovered ? 4 : 3}
              />
              <circle
                className={`workout-weekly-chart__point workout-weekly-chart__point--workouts${isHovered ? " workout-weekly-chart__point--active" : ""}`}
                cx={point.x}
                cy={point.workoutY}
                r={isHovered ? 4 : 3}
              />
            </g>
          );
        })}
      </svg>
      <div className="workout-weekly-chart__legend" aria-hidden="true">
        <span className="workout-weekly-chart__legend-item workout-weekly-chart__legend-item--workouts">тренировки</span>
        <span className="workout-weekly-chart__legend-item workout-weekly-chart__legend-item--activity">прочая активность</span>
      </div>
    </div>
  );
}
