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
const BAR_RADIUS = 4;

interface WeekBarLayout {
  entry: AthleteWorkoutWeeklyEntry;
  x: number;
  centerX: number;
  width: number;
  slotX: number;
  slotWidth: number;
  workoutsTop: number;
  workoutsBottom: number;
  activityTop: number;
  activityBottom: number;
  total: number;
}

function buildCountTicks(bounds: ReturnType<typeof computeWorkoutWeeklyChartBounds>): number[] {
  if (bounds.yMax <= 2) {
    return [0, 1, bounds.yMax];
  }
  const mid = Math.round((bounds.yMin + bounds.yMax) / 2);
  return [bounds.yMin, mid, bounds.yMax];
}

function buildWeekBarLayouts(
  entries: AthleteWorkoutWeeklyEntry[],
  bounds: ReturnType<typeof computeWorkoutWeeklyChartBounds>,
): WeekBarLayout[] {
  if (entries.length === 0) return [];

  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const slotWidth = plotWidth / entries.length;
  const barWidth = Math.max(8, Math.min(24, slotWidth * 0.62));
  const baseline = countToChartY(0, bounds, PLOT_TOP, PLOT_BOTTOM);

  return entries.map((entry, index) => {
    const slotX = PLOT_LEFT + slotWidth * index;
    const x = slotX + (slotWidth - barWidth) / 2;
    const workoutsTop = countToChartY(entry.workouts_count, bounds, PLOT_TOP, PLOT_BOTTOM);
    const stackTop = countToChartY(
      entry.workouts_count + entry.other_activity_count,
      bounds,
      PLOT_TOP,
      PLOT_BOTTOM,
    );

    return {
      entry,
      x,
      centerX: slotX + slotWidth / 2,
      width: barWidth,
      slotX,
      slotWidth,
      workoutsTop,
      workoutsBottom: baseline,
      activityTop: stackTop,
      activityBottom: workoutsTop,
      total: entry.workouts_count + entry.other_activity_count,
    };
  });
}

/** Bar segment with optional rounded top corners (SVG y grows downward). */
function barSegmentPath(
  x: number,
  yTop: number,
  width: number,
  yBottom: number,
  roundTop: boolean,
): string {
  const height = yBottom - yTop;
  if (height <= 0) return "";

  const radius = roundTop ? Math.min(BAR_RADIUS, width / 2, height / 2) : 0;
  if (radius <= 0) {
    return `M ${x} ${yTop} h ${width} v ${height} h ${-width} Z`;
  }

  return [
    `M ${x} ${yBottom}`,
    `L ${x + width} ${yBottom}`,
    `L ${x + width} ${yTop + radius}`,
    `Q ${x + width} ${yTop} ${x + width - radius} ${yTop}`,
    `L ${x + radius} ${yTop}`,
    `Q ${x} ${yTop} ${x} ${yTop + radius}`,
    "Z",
  ].join(" ");
}

export interface WorkoutWeeklyChartProps {
  entries: AthleteWorkoutWeeklyEntry[];
}

export function WorkoutWeeklyChart({ entries }: WorkoutWeeklyChartProps) {
  const [hoveredWeek, setHoveredWeek] = useState<string | null>(null);
  const bounds = useMemo(
    () =>
      computeWorkoutWeeklyChartBounds(
        entries.map((entry) => entry.workouts_count + entry.other_activity_count),
      ),
    [entries],
  );
  const bars = useMemo(() => buildWeekBarLayouts(entries, bounds), [bounds, entries]);
  const yTicks = useMemo(() => buildCountTicks(bounds), [bounds]);
  const hoveredBar = useMemo(
    () => bars.find((bar) => bar.entry.week_start === hoveredWeek) ?? null,
    [bars, hoveredWeek],
  );

  if (entries.length === 0) {
    return (
      <div className="weight-dynamics__chart-empty">
        <p className="text-secondary">Нет данных за выбранный период.</p>
      </div>
    );
  }

  const tooltipTopY = hoveredBar
    ? hoveredBar.total > 0
      ? hoveredBar.activityTop
      : (PLOT_TOP + PLOT_BOTTOM) / 2
    : 0;

  return (
    <div className="workout-weekly-chart weight-dynamics__chart-wrap">
      {hoveredBar ? (
        <div
          className="weight-dynamics__tooltip"
          style={{
            left: `${(hoveredBar.centerX / CHART_WIDTH) * 100}%`,
            top: `${(tooltipTopY / CHART_HEIGHT) * 100}%`,
          }}
        >
          {formatWorkoutWeekTooltip(
            hoveredBar.entry.week_start,
            hoveredBar.entry.workouts_count,
            hoveredBar.entry.other_activity_count,
          )}
        </div>
      ) : null}
      <svg
        className="weight-dynamics__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Столбчатый график тренировок и прочей активности по неделям"
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

        {bars.map((bar) => {
          const isHovered = hoveredWeek === bar.entry.week_start;
          const { entry } = bar;
          const hasWorkouts = entry.workouts_count > 0;
          const hasActivity = entry.other_activity_count > 0;
          const hoverClass = isHovered ? " workout-weekly-chart__bar-segment--active" : "";

          return (
            <g key={entry.week_start}>
              {hasWorkouts ? (
                <path
                  className={`workout-weekly-chart__bar-segment workout-weekly-chart__bar-segment--workouts${hoverClass}`}
                  d={barSegmentPath(
                    bar.x,
                    bar.workoutsTop,
                    bar.width,
                    bar.workoutsBottom,
                    !hasActivity,
                  )}
                />
              ) : null}
              {hasActivity ? (
                <path
                  className={`workout-weekly-chart__bar-segment workout-weekly-chart__bar-segment--activity${hoverClass}`}
                  d={barSegmentPath(
                    bar.x,
                    bar.activityTop,
                    bar.width,
                    hasWorkouts ? bar.activityBottom : bar.workoutsBottom,
                    true,
                  )}
                />
              ) : null}
              <rect
                className="workout-weekly-chart__week-hit"
                x={bar.slotX}
                y={PLOT_TOP}
                width={bar.slotWidth}
                height={PLOT_BOTTOM - PLOT_TOP}
                onMouseEnter={() => setHoveredWeek(entry.week_start)}
                onTouchStart={() => setHoveredWeek(entry.week_start)}
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
