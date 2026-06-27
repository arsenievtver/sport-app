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

interface ChartPoint {
  x: number;
  y: number;
  entry: AthleteWorkoutWeeklyEntry;
}

function buildChartPoints(entries: AthleteWorkoutWeeklyEntry[], bounds: ReturnType<typeof computeWorkoutWeeklyChartBounds>): ChartPoint[] {
  if (entries.length === 0) return [];
  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const step = entries.length === 1 ? 0 : plotWidth / (entries.length - 1);

  return entries.map((entry, index) => ({
    entry,
    x: PLOT_LEFT + step * index,
    y: countToChartY(entry.workouts_count, bounds, PLOT_TOP, PLOT_BOTTOM),
  }));
}

function buildSmoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;

    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next.y - (following.y - current.y) / 6;

    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`;
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
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const bounds = useMemo(() => computeWorkoutWeeklyChartBounds(entries.map((entry) => entry.workouts_count)), [entries]);
  const points = useMemo(() => buildChartPoints(entries, bounds), [bounds, entries]);
  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);
  const yTicks = useMemo(() => buildCountTicks(bounds), [bounds]);

  if (entries.length === 0) {
    return (
      <div className="weight-dynamics__chart-empty">
        <p className="text-secondary">Нет данных за выбранный период.</p>
      </div>
    );
  }

  return (
    <div className="workout-weekly-chart weight-dynamics__chart-wrap">
      {hoveredPoint ? (
        <div
          className="weight-dynamics__tooltip"
          style={{
            left: `${(hoveredPoint.x / CHART_WIDTH) * 100}%`,
            top: `${(hoveredPoint.y / CHART_HEIGHT) * 100}%`,
          }}
        >
          {formatWorkoutWeekTooltip(hoveredPoint.entry.week_start, hoveredPoint.entry.workouts_count)}
        </div>
      ) : null}
      <svg
        className="weight-dynamics__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="График динамики тренировок по неделям"
        onMouseLeave={() => setHoveredPoint(null)}
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

        {points.length > 1 ? <path className="weight-dynamics__line" d={linePath} /> : null}

        {points.map((point) => {
          const isHovered = hoveredPoint?.entry.week_start === point.entry.week_start;
          return (
            <g key={point.entry.week_start}>
              <circle
                className="weight-dynamics__point-hit"
                cx={point.x}
                cy={point.y}
                r="12"
                tabIndex={0}
                onMouseEnter={() => setHoveredPoint(point)}
                onTouchStart={() => setHoveredPoint(point)}
                onFocus={() => setHoveredPoint(point)}
                onBlur={() => setHoveredPoint(null)}
              />
              <circle
                className={`weight-dynamics__point${isHovered ? " weight-dynamics__point--active" : ""}`}
                cx={point.x}
                cy={point.y}
                r={isHovered ? 4 : 3}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
