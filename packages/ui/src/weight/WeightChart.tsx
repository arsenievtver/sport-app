import { useMemo, useState } from "react";
import type { AthleteWeightEntry } from "@sport-app/shared";
import {
  computeWeightChartBounds,
  formatWeightChartDate,
  formatWeightKg,
  formatWeightMeasurementDate,
  weightToChartY,
} from "@sport-app/shared";
import { ChartPointTooltip } from "./ChartPointTooltip";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 200;
const PLOT_LEFT = 40;
const PLOT_RIGHT = 308;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 168;

interface ChartPoint {
  x: number;
  y: number;
  entry: AthleteWeightEntry;
}

function buildChartPoints(
  entries: AthleteWeightEntry[],
  bounds: NonNullable<ReturnType<typeof computeWeightChartBounds>>,
): ChartPoint[] {
  if (entries.length === 0) return [];
  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const step = entries.length === 1 ? 0 : plotWidth / (entries.length - 1);

  return entries.map((entry, index) => ({
    entry,
    x: PLOT_LEFT + step * index,
    y: weightToChartY(entry.weight_kg, bounds, PLOT_TOP, PLOT_BOTTOM),
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

export interface WeightChartProps {
  entries: AthleteWeightEntry[];
  targetMin?: number | null;
  targetMax?: number | null;
  emptyMessage?: string;
}

export function WeightChart({
  entries,
  targetMin,
  targetMax,
  emptyMessage = "Добавь первое измерение — график появится здесь.",
}: WeightChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const bounds = useMemo(() => computeWeightChartBounds(entries), [entries]);
  const points = useMemo(
    () => (bounds ? buildChartPoints(entries, bounds) : []),
    [bounds, entries],
  );
  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);

  if (!bounds || entries.length === 0) {
    return (
      <div className="weight-dynamics__chart-empty">
        <p className="text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  const hasTargetZone = targetMin != null && targetMax != null && targetMax >= targetMin;
  const targetTop = hasTargetZone
    ? weightToChartY(targetMax, bounds, PLOT_TOP, PLOT_BOTTOM)
    : null;
  const targetBottom = hasTargetZone
    ? weightToChartY(targetMin, bounds, PLOT_TOP, PLOT_BOTTOM)
    : null;
  const yTicks = [bounds.yMin, (bounds.yMin + bounds.yMax) / 2, bounds.yMax];

  return (
    <div className="weight-dynamics__chart-wrap">
      {hoveredPoint ? (
        <ChartPointTooltip
          anchorXPercent={(hoveredPoint.x / CHART_WIDTH) * 100}
          anchorYPercent={(hoveredPoint.y / CHART_HEIGHT) * 100}
        >
          {formatWeightKg(hoveredPoint.entry.weight_kg)} кг ·{" "}
          {formatWeightMeasurementDate(hoveredPoint.entry.entry_date)}
        </ChartPointTooltip>
      ) : null}
      <svg
        className="weight-dynamics__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="График динамики веса"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {hasTargetZone && targetTop != null && targetBottom != null ? (
          <rect
            className="weight-dynamics__target-zone"
            x={PLOT_LEFT}
            y={targetTop}
            width={PLOT_RIGHT - PLOT_LEFT}
            height={Math.max(targetBottom - targetTop, 1)}
          />
        ) : null}

        {yTicks.map((tick) => {
          const y = weightToChartY(tick, bounds, PLOT_TOP, PLOT_BOTTOM);
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
                {formatWeightKg(tick)}
              </text>
            </g>
          );
        })}

        {points.length > 1 ? <path className="weight-dynamics__line" d={linePath} /> : null}

        {points.map((point) => {
          const isHovered = hoveredPoint?.entry.id === point.entry.id;
          return (
            <g key={point.entry.id}>
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
              <text
                className="weight-dynamics__axis-label weight-dynamics__axis-label--x"
                x={point.x}
                y={CHART_HEIGHT - 6}
                textAnchor="middle"
              >
                {formatWeightChartDate(point.entry.entry_date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
